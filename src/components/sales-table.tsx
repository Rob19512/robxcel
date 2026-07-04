"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, CheckCircle2, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StickyTableHead,
  StickyTableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTextArea, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkEncaissementButton } from "@/components/bulk-encaissement-button";
import { TablePagination } from "@/components/table-pagination";
import { eur, TVA_RATES } from "@/lib/format";
import { computeSale } from "@/lib/calc";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createSale,
  updateSaleField,
  updateSaleCustomValue,
  updateSaleEventId,
  deleteSale,
  restoreSale,
  bulkDeleteSales,
  bulkRestoreSales,
  bulkUpdateSaleDates,
  duplicateSale,
  markSaleEncaisseToday,
  type SaleCoreField,
} from "@/lib/actions/sale-actions";

export type SaleRow = {
  id: string;
  dateVente: string;
  dateEncaissement: string | null;
  source: string | null;
  eventId: string | null;
  statut: "EN_ATTENTE" | "ENCAISSE" | "LITIGE";
  description: string | null;
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
  tauxTvaVente: number;
  tauxTvaAchat: number;
  notes: string | null;
  customValues: Record<string, string>;
};

export type CategoryFieldDef = {
  id: string;
  key: string;
  label: string;
  fieldType: "TEXT" | "NUMBER" | "DATE";
};

const STATUT_OPTIONS = [
  { value: "ENCAISSE", label: "✅ Encaissé" },
  { value: "EN_ATTENTE", label: "⏳ En attente" },
  { value: "LITIGE", label: "⚠️ Litige" },
];

const statutBadgeVariant: Record<SaleRow["statut"], string> = {
  ENCAISSE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  LITIGE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const tvaOptions = TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` }));

export type EventOption = { id: string; label: string };

export function SalesTable({
  categoryId,
  path,
  initialSales,
  fields,
  sources,
  events,
  showDescription = true,
}: {
  categoryId: string;
  path: string;
  initialSales: SaleRow[];
  fields: CategoryFieldDef[];
  sources: string[];
  events?: EventOption[];
  showDescription?: boolean;
}) {
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [sortMode, setSortMode] = useState<"date" | "evenement">("evenement");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility("sales");
  const columns: ColumnDef[] = useMemo(
    () => [
      { key: "dateEncaissement", label: "Date encaissement" },
      { key: "statut", label: "Statut" },
      { key: "source", label: "Source" },
      ...(events ? [{ key: "evenement", label: "Événement" }] : []),
      ...(showDescription ? [{ key: "description", label: "Description" }] : []),
      ...fields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
      { key: "qty", label: "Qté" },
      { key: "prixVente", label: "Prix vente unit." },
      { key: "coutAchat", label: "Coût achat unit." },
      { key: "totalEncaisse", label: "Total encaissé" },
      { key: "margeBrute", label: "Marge brute" },
      { key: "tvaVente", label: "TVA vente" },
      { key: "tvaCollectee", label: "TVA collectée" },
      { key: "tvaAchat", label: "TVA achat" },
      { key: "tvaDed", label: "TVA déd." },
      { key: "beneficeApresTva", label: "Bénéf. après TVA" },
    ],
    [events, showDescription, fields]
  );

  useMemo(() => setSales(initialSales), [initialSales]);

  const eventLabelById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.label])), [events]);

  const filtered = useMemo(() => {
    const result = sales.filter((s) => {
      if (statutFilter !== "ALL" && s.statut !== statutFilter) return false;
      if (!search.trim()) return true;
      const haystack = normalizeForSearch(
        [
          s.description,
          s.source,
          s.notes,
          s.eventId ? eventLabelById.get(s.eventId) : null,
          String(s.qty),
          String(s.prixVenteUnit),
          String(s.coutAchatUnit),
          ...Object.values(s.customValues ?? {}),
        ]
          .join(" ")
      );
      return haystack.includes(normalizeForSearch(search));
    });

    if (events && sortMode === "evenement") {
      result.sort((a, b) => {
        const la = a.eventId ? eventLabelById.get(a.eventId) ?? "" : "";
        const lb = b.eventId ? eventLabelById.get(b.eventId) ?? "" : "";
        if (la === lb) return 0;
        if (!la) return 1;
        if (!lb) return -1;
        return la.localeCompare(lb);
      });
    }

    // Les lignes tout juste ajoutées passent devant, quel que soit le tri : sinon une
    // ligne vide (sans événement) tombe en fin de liste et se retrouve sur la dernière
    // page, obligeant à naviguer jusqu'au bout pour la remplir.
    if (newIds.size > 0) {
      const fresh: typeof result = [];
      const rest: typeof result = [];
      for (const s of result) (newIds.has(s.id) ? fresh : rest).push(s);
      return [...fresh, ...rest];
    }
    return result;
  }, [sales, statutFilter, search, eventLabelById, events, sortMode, newIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  // Repart à la première page quand le filtre/tri change, pour ne pas rester
  // coincé au milieu d'un nouveau résultat de recherche.
  useEffect(() => {
    setPage(0);
  }, [search, statutFilter, sortMode]);

  const sourceOptions = useMemo(() => sources.map((s) => ({ value: s, label: s })), [sources]);

  function handleAdd() {
    startTransition(async () => {
      try {
        const id = await createSale(categoryId, path);
        setNewIds((prev) => new Set(prev).add(id));
        setPage(0);
      } catch {
        toast.error("Impossible d'ajouter la ligne");
      }
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id))
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkDeleteSales(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreSales(ids, path);
                toast.success("Restauré");
              });
            },
          },
        });
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function handleBulkEncaissement(dateVente: string | null, dateEncaissement: string | null) {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkUpdateSaleDates(ids, path, dateVente, dateEncaissement);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} mise${ids.length > 1 ? "s" : ""} à jour`);
      } catch {
        toast.error("Impossible de mettre à jour l'encaissement");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSale(id, path);
        toast.success("Ligne supprimée", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreSale(id, path);
                toast.success("Restauré");
              });
            },
          },
        });
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateSale(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function handleMarkEncaisse(id: string) {
    startTransition(async () => {
      try {
        await markSaleEncaisseToday(id, path);
        toast.success("Marqué encaissé aujourd'hui");
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function saveField(id: string, field: SaleCoreField) {
    return (value: string) => updateSaleField(id, path, field, value);
  }

  function handleExport() {
    downloadCsv(
      `ventes-${path.replaceAll("/", "-").slice(1)}.csv`,
      filtered.map((s) => {
        const calc = computeSale(s);
        const row: Record<string, unknown> = {
          "Date vente": s.dateVente,
          "Date encaissement": s.dateEncaissement ?? "",
          Statut: s.statut,
          Source: s.source ?? "",
        };
        if (showDescription) row.Description = s.description ?? "";
        for (const f of fields) row[f.label] = s.customValues?.[f.key] ?? "";
        Object.assign(row, {
          "Qté": s.qty,
          "Prix vente unit.": s.prixVenteUnit,
          "Coût achat unit.": s.coutAchatUnit,
          "Total encaissé": calc.totalEncaisse,
          "Marge brute": calc.margeBrute,
          "Taux TVA vente": s.tauxTvaVente,
          "TVA collectée": calc.tvaCollectee,
          "Taux TVA achat": s.tauxTvaAchat,
          "TVA déductible achat": calc.tvaDeductibleAchat,
          "Bénéf. net après TVA": calc.beneficeNetApresTva,
          Notes: s.notes ?? "",
        });
        return row;
      })
    );
  }

  function saveCustom(id: string, key: string) {
    return (value: string) => updateSaleCustomValue(id, path, key, value);
  }

  function saveEvent(id: string) {
    return (value: string) => updateSaleEventId(id, path, value || null);
  }

  const eventOptions = (events ?? []).map((e) => ({ value: e.id, label: e.label }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter une vente
        </Button>
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <Select
          value={statutFilter}
          onValueChange={(v) => setStatutFilter(v ?? "ALL")}
          items={[{ value: "ALL", label: "Tous les statuts" }, ...STATUT_OPTIONS]}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {STATUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {events && (
          <ToggleGroup
            value={[sortMode]}
            onValueChange={(v) => v[0] && setSortMode(v[0] as typeof sortMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="date">Trier par date</ToggleGroupItem>
            <ToggleGroupItem value="evenement">Trier par événement</ToggleGroupItem>
          </ToggleGroup>
        )}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download />
          Exporter CSV
        </Button>
        <ColumnVisibilityMenu columns={columns} isVisible={isVisible} toggle={toggleColumn} />
        <BulkEncaissementButton count={selectedIds.size} onConfirm={handleBulkEncaissement} />
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} ligne{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table containerRef={scrollRef}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <StickyTableHead className="min-w-32" stickyClassName={STICKY_COL}>Date vente</StickyTableHead>
                {isVisible("dateEncaissement") && <TableHead className="min-w-32">Date encaissement</TableHead>}
                {isVisible("statut") && <TableHead className="min-w-36">Statut</TableHead>}
                {isVisible("source") && <TableHead className="min-w-36">Source</TableHead>}
                {events && isVisible("evenement") && <TableHead className="min-w-48">Événement</TableHead>}
                {showDescription && isVisible("description") && <TableHead className="min-w-48">Description</TableHead>}
                {fields.map((f) => isVisible(`custom:${f.key}`) && (
                  <TableHead key={f.id} className="min-w-36">
                    {f.label}
                  </TableHead>
                ))}
                {isVisible("qty") && <TableHead className="min-w-16">Qté</TableHead>}
                {isVisible("prixVente") && <TableHead className="min-w-28">Prix vente unit.</TableHead>}
                {isVisible("coutAchat") && <TableHead className="min-w-28">Coût achat unit.</TableHead>}
                {isVisible("totalEncaisse") && <TableHead className="min-w-28">Total encaissé</TableHead>}
                {isVisible("margeBrute") && <TableHead className="min-w-28">Marge brute</TableHead>}
                {isVisible("tvaVente") && <TableHead className="min-w-24">TVA vente</TableHead>}
                {isVisible("tvaCollectee") && <TableHead className="min-w-24">TVA collectée</TableHead>}
                {isVisible("tvaAchat") && <TableHead className="min-w-24">TVA achat</TableHead>}
                {isVisible("tvaDed") && <TableHead className="min-w-24">TVA déd.</TableHead>}
                {isVisible("beneficeApresTva") && <TableHead className="min-w-28">Bénéf. après TVA</TableHead>}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => {
                const calc = computeSale(s);
                return (
                  <TableRow key={s.id} data-state={selectedIds.has(s.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineDate value={s.dateVente} onSave={saveField(s.id, "dateVente")} />
                    </StickyTableCell>
                    {isVisible("dateEncaissement") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <InlineDate
                            value={s.dateEncaissement ?? ""}
                            onSave={saveField(s.id, "dateEncaissement")}
                          />
                          {!s.dateEncaissement && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Marquer encaissé aujourd'hui"
                              onClick={() => handleMarkEncaisse(s.id)}
                            >
                              <CheckCircle2 className="text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible("statut") && (
                      <TableCell>
                        <InlineSelect
                          value={s.statut}
                          options={STATUT_OPTIONS}
                          onSave={saveField(s.id, "statut")}
                        />
                      </TableCell>
                    )}
                    {isVisible("source") && (
                      <TableCell>
                        <InlineSelect
                          value={s.source ?? ""}
                          options={sourceOptions}
                          placeholder="Source"
                          onSave={saveField(s.id, "source")}
                        />
                      </TableCell>
                    )}
                    {events && isVisible("evenement") && (
                      <TableCell>
                        <InlineSelect
                          value={s.eventId ?? ""}
                          options={eventOptions}
                          placeholder="Événement"
                          onSave={saveEvent(s.id)}
                        />
                      </TableCell>
                    )}
                    {showDescription && isVisible("description") && (
                      <TableCell>
                        <InlineTextArea
                          value={s.description ?? ""}
                          onSave={saveField(s.id, "description")}
                          testId="sale-description"
                        />
                      </TableCell>
                    )}
                    {fields.map((f) => isVisible(`custom:${f.key}`) && (
                      <TableCell key={f.id}>
                        {f.fieldType === "DATE" ? (
                          <InlineDate
                            value={s.customValues?.[f.key] ?? ""}
                            onSave={saveCustom(s.id, f.key)}
                          />
                        ) : f.fieldType === "NUMBER" ? (
                          <InlineNumber
                            value={Number(s.customValues?.[f.key] ?? 0)}
                            onSave={saveCustom(s.id, f.key)}
                          />
                        ) : (
                          <InlineTextArea
                            value={s.customValues?.[f.key] ?? ""}
                            onSave={saveCustom(s.id, f.key)}
                          />
                        )}
                      </TableCell>
                    ))}
                    {isVisible("qty") && (
                      <TableCell>
                        <InlineNumber value={s.qty} step="1" onSave={saveField(s.id, "qty")} />
                      </TableCell>
                    )}
                    {isVisible("prixVente") && (
                      <TableCell>
                        <InlineNumber value={s.prixVenteUnit} onSave={saveField(s.id, "prixVenteUnit")} />
                      </TableCell>
                    )}
                    {isVisible("coutAchat") && (
                      <TableCell>
                        <InlineNumber value={s.coutAchatUnit} onSave={saveField(s.id, "coutAchatUnit")} />
                      </TableCell>
                    )}
                    {isVisible("totalEncaisse") && (
                      <TableCell className="text-center tabular-nums font-medium">
                        {eur.format(calc.totalEncaisse)}
                      </TableCell>
                    )}
                    {isVisible("margeBrute") && (
                      <TableCell className="text-center tabular-nums">
                        {eur.format(calc.margeBrute)}
                      </TableCell>
                    )}
                    {isVisible("tvaVente") && (
                      <TableCell>
                        <InlineSelect
                          value={String(s.tauxTvaVente)}
                          options={tvaOptions}
                          onSave={saveField(s.id, "tauxTvaVente")}
                        />
                      </TableCell>
                    )}
                    {isVisible("tvaCollectee") && (
                      <TableCell className="text-center tabular-nums">
                        {eur.format(calc.tvaCollectee)}
                      </TableCell>
                    )}
                    {isVisible("tvaAchat") && (
                      <TableCell>
                        <InlineSelect
                          value={String(s.tauxTvaAchat)}
                          options={tvaOptions}
                          onSave={saveField(s.id, "tauxTvaAchat")}
                        />
                      </TableCell>
                    )}
                    {isVisible("tvaDed") && (
                      <TableCell className="text-center tabular-nums">
                        {eur.format(calc.tvaDeductibleAchat)}
                      </TableCell>
                    )}
                    {isVisible("beneficeApresTva") && (
                      <TableCell className="text-center tabular-nums font-medium">
                        {eur.format(calc.beneficeNetApresTva)}
                      </TableCell>
                    )}
                    <TableCell>
                      <RowMenu
                        onDuplicate={() => handleDuplicate(s.id)}
                        onDelete={() => handleDelete(s.id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={17 + fields.length + (events ? 1 : 0) + (showDescription ? 1 : 0)}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucune vente pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        <div className="border-t p-3">
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {paginated.map((s) => {
          const calc = computeSale(s);
          return (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                    <Badge className={statutBadgeVariant[s.statut]}>
                      {STATUT_OPTIONS.find((o) => o.value === s.statut)?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {eur.format(calc.totalEncaisse)}
                    </span>
                    <RowMenu
                      onDuplicate={() => handleDuplicate(s.id)}
                      onDelete={() => handleDelete(s.id)}
                    />
                  </div>
                </div>
                {showDescription && (
                  <InlineTextArea
                    value={s.description ?? ""}
                    placeholder="Description"
                    onSave={saveField(s.id, "description")}
                    className="text-base font-medium"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date vente">
                    <InlineDate value={s.dateVente} onSave={saveField(s.id, "dateVente")} />
                  </Field>
                  <Field label="Date encaissement">
                    <div className="flex items-center gap-1">
                      <InlineDate
                        value={s.dateEncaissement ?? ""}
                        onSave={saveField(s.id, "dateEncaissement")}
                      />
                      {!s.dateEncaissement && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleMarkEncaisse(s.id)}
                        >
                          <CheckCircle2 className="text-emerald-600" />
                        </Button>
                      )}
                    </div>
                  </Field>
                  <Field label="Source">
                    <InlineSelect
                      value={s.source ?? ""}
                      options={sourceOptions}
                      placeholder="Source"
                      onSave={saveField(s.id, "source")}
                    />
                  </Field>
                  {events && (
                    <Field label="Événement">
                      <InlineSelect
                        value={s.eventId ?? ""}
                        options={eventOptions}
                        placeholder="Événement"
                        onSave={saveEvent(s.id)}
                      />
                    </Field>
                  )}
                  <Field label="Qté">
                    <InlineNumber value={s.qty} step="1" onSave={saveField(s.id, "qty")} />
                  </Field>
                  <Field label="Prix vente unit.">
                    <InlineNumber value={s.prixVenteUnit} onSave={saveField(s.id, "prixVenteUnit")} />
                  </Field>
                  <Field label="Coût achat unit.">
                    <InlineNumber value={s.coutAchatUnit} onSave={saveField(s.id, "coutAchatUnit")} />
                  </Field>
                  {fields.map((f) => (
                    <Field key={f.id} label={f.label}>
                      {f.fieldType === "DATE" ? (
                        <InlineDate
                          value={s.customValues?.[f.key] ?? ""}
                          onSave={saveCustom(s.id, f.key)}
                        />
                      ) : f.fieldType === "NUMBER" ? (
                        <InlineNumber
                          value={Number(s.customValues?.[f.key] ?? 0)}
                          onSave={saveCustom(s.id, f.key)}
                        />
                      ) : (
                        <InlineTextArea
                          value={s.customValues?.[f.key] ?? ""}
                          onSave={saveCustom(s.id, f.key)}
                        />
                      )}
                    </Field>
                  ))}
                  <Field label="TVA vente">
                    <InlineSelect
                      value={String(s.tauxTvaVente)}
                      options={tvaOptions}
                      onSave={saveField(s.id, "tauxTvaVente")}
                    />
                  </Field>
                  <Field label="TVA achat">
                    <InlineSelect
                      value={String(s.tauxTvaAchat)}
                      options={tvaOptions}
                      onSave={saveField(s.id, "tauxTvaAchat")}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Bénéf. net après TVA</span>
                  <span className="font-semibold tabular-nums">
                    {eur.format(calc.beneficeNetApresTva)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune vente pour l&apos;instant.
          </p>
        )}
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function RowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" data-testid="row-actions" />}
      >
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          Dupliquer
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
