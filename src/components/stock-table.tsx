"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, PackageCheck, CheckCircle2, Download, ChevronDown } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkEncaissementButton } from "@/components/bulk-encaissement-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineTextArea, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { BulkAddStockDialog } from "@/components/bulk-add-stock-dialog";
import { TablePagination } from "@/components/table-pagination";
import { eur, TVA_RATES } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createStockItem,
  updateStockField,
  updateStockCustomValue,
  updateStockDate,
  updateStockEventId,
  deleteStockItem,
  restoreStockItem,
  bulkDeleteStockItems,
  bulkRestoreStockItems,
  bulkUpdateStockDates,
  duplicateStockItem,
  markStockVenduToday,
  markStockEncaisseToday,
  type StockCoreField,
} from "@/lib/actions/stock-actions";
import type { CategoryFieldDef, EventOption } from "@/components/sales-table";

export type StockRow = {
  id: string;
  dateAchat: string;
  description: string | null;
  source: string | null;
  eventId: string | null;
  qty: number;
  coutAchatUnit: number;
  prixCibleVente: number | null;
  priorite: "URGENT" | "NORMAL" | "PAS_PRESSE" | null;
  recu: boolean | null;
  tauxTvaAchat: number;
  dateVente: string | null;
  dateEncaissement: string | null;
  statut: "EN_STOCK" | "EN_ATTENTE" | "VENDU";
  compteEmail: string | null;
  notes: string | null;
  customValues: Record<string, string>;
};

const STATUT_LABEL: Record<StockRow["statut"], string> = {
  EN_STOCK: "📦 En stock",
  EN_ATTENTE: "⏳ En attente",
  VENDU: "✅ Vendu",
};

const statutBadgeVariant: Record<StockRow["statut"], string> = {
  EN_STOCK: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  VENDU: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const PRIORITE_OPTIONS = [
  { value: "URGENT", label: "🔴 Urgent" },
  { value: "NORMAL", label: "🟡 Normal" },
  { value: "PAS_PRESSE", label: "🟢 Pas pressé" },
];

const RECU_OPTIONS = [
  { value: "true", label: "🟢 Reçu" },
  { value: "false", label: "🔴 Pas reçu" },
];

const tvaOptions = TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` }));

export function StockTable({
  categoryId,
  path,
  initialItems,
  fields,
  sources,
  trackPriorite,
  trackRecu,
  events,
  hideAddButtons,
  showDescription = true,
  showCompteEmail = true,
}: {
  categoryId: string;
  path: string;
  initialItems: StockRow[];
  fields: CategoryFieldDef[];
  sources: string[];
  trackPriorite: boolean;
  trackRecu: boolean;
  events?: EventOption[];
  hideAddButtons?: boolean;
  showDescription?: boolean;
  showCompteEmail?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [sortMode, setSortMode] = useState<"date" | "evenement">("evenement");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 50;
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility("stock");
  const columns: ColumnDef[] = useMemo(
    () => [
      ...(showDescription ? [{ key: "description", label: "Description" }] : []),
      { key: "source", label: "Source cible" },
      ...(events ? [{ key: "evenement", label: "Événement" }] : []),
      ...fields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
      { key: "qty", label: "Qté" },
      { key: "coutAchat", label: "Coût achat unit." },
      { key: "prixCible", label: "Prix cible vente" },
      { key: "marge", label: "Marge" },
      ...(trackPriorite ? [{ key: "priorite", label: "Priorité" }] : []),
      ...(trackRecu ? [{ key: "recu", label: "Reçu" }] : []),
      { key: "tvaAchat", label: "TVA achat" },
      { key: "tvaDed", label: "TVA déd." },
      { key: "dateVente", label: "Date de vente" },
      { key: "dateEncaissement", label: "Date encaissement" },
      { key: "statut", label: "Statut" },
      ...(showCompteEmail ? [{ key: "compteEmail", label: "Compte (email)" }] : []),
    ],
    [showDescription, events, fields, trackPriorite, trackRecu, showCompteEmail]
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = initialItems;
  const sourceOptions = useMemo(() => sources.map((s) => ({ value: s, label: s })), [sources]);
  const eventLabelById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.label])), [events]);

  const filtered = useMemo(() => {
    const result = items.filter((it) => {
      if (!showSold && it.statut === "VENDU") return false;
      if (!search.trim()) return true;
      const haystack = normalizeForSearch(
        [
          it.description,
          it.source,
          it.notes,
          it.compteEmail,
          it.eventId ? eventLabelById.get(it.eventId) : null,
          String(it.qty),
          String(it.coutAchatUnit),
          it.prixCibleVente !== null ? String(it.prixCibleVente) : null,
          ...Object.values(it.customValues ?? {}),
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
        if (!la) return 1; // sans événement à la fin
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
      for (const it of result) (newIds.has(it.id) ? fresh : rest).push(it);
      return [...fresh, ...rest];
    }
    return result;
  }, [items, showSold, search, eventLabelById, events, sortMode, newIds]);

  // Rendre 50 lignes à la fois au lieu de centaines d'un coup évite de monter
  // des centaines de champs éditables en même temps (lent).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);

  // Repart à la première page quand le filtre/tri change, pour ne pas rester
  // coincé au milieu d'un nouveau résultat de recherche.
  useEffect(() => {
    setPage(0);
  }, [search, showSold, sortMode]);
  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  function handleAdd() {
    startTransition(async () => {
      try {
        const id = await createStockItem(categoryId, path);
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
      prev.size === filtered.length ? new Set() : new Set(filtered.map((it) => it.id))
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkDeleteStockItems(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} article${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreStockItems(ids, path);
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
        await bulkUpdateStockDates(ids, path, dateVente, dateEncaissement);
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
        await deleteStockItem(id, path);
        toast.success("Article supprimé", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreStockItem(id, path);
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
        await duplicateStockItem(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function handleMarkVendu(id: string) {
    startTransition(async () => {
      try {
        await markStockVenduToday(id, path);
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function handleMarkEncaisse(id: string) {
    startTransition(async () => {
      try {
        await markStockEncaisseToday(id, path);
        toast.success("Vente créée automatiquement");
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function saveField(id: string, field: StockCoreField) {
    return (value: string) => updateStockField(id, path, field, value);
  }

  function saveDate(id: string, field: "dateVente" | "dateEncaissement") {
    return (value: string) => updateStockDate(id, path, field, value || null);
  }

  function saveCustom(id: string, key: string) {
    return (value: string) => updateStockCustomValue(id, path, key, value);
  }

  function saveEvent(id: string) {
    return (value: string) => updateStockEventId(id, path, value || null);
  }

  const eventOptions = (events ?? []).map((e) => ({ value: e.id, label: e.label }));

  function handleExport() {
    downloadCsv(
      `stock-${path.replaceAll("/", "-").slice(1)}.csv`,
      filtered.map((it) => {
        const margeCible = it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : "";
        const row: Record<string, unknown> = { "Date achat": it.dateAchat };
        if (showDescription) row.Description = it.description ?? "";
        row["Source cible"] = it.source ?? "";
        for (const f of fields) row[f.label] = it.customValues?.[f.key] ?? "";
        Object.assign(row, {
          "Qté": it.qty,
          "Coût achat unit.": it.coutAchatUnit,
          "Prix cible vente": it.prixCibleVente ?? "",
          "Marge": margeCible,
          "Taux TVA achat": it.tauxTvaAchat,
          "Date de vente": it.dateVente ?? "",
          "Date encaissement": it.dateEncaissement ?? "",
          Statut: it.statut,
        });
        if (showCompteEmail) row["Compte (email)"] = it.compteEmail ?? "";
        row.Notes = it.notes ?? "";
        return row;
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!hideAddButtons && (
          <>
            <Button onClick={handleAdd} disabled={isPending} size="sm">
              <Plus />
              Ajouter en stock
            </Button>
            <BulkAddStockDialog
              categoryId={categoryId}
              path={path}
              fields={fields}
              trackPriorite={trackPriorite}
              trackRecu={trackRecu}
              events={events}
            />
          </>
        )}
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showSold} onCheckedChange={(v) => setShowSold(!!v)} />
          Afficher les vendus
        </label>
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
          {filtered.length} article{filtered.length > 1 ? "s" : ""}
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
                <StickyTableHead className="min-w-32" stickyClassName={STICKY_COL}>Date achat</StickyTableHead>
                {showDescription && isVisible("description") && <TableHead className="min-w-48">Description</TableHead>}
                {isVisible("source") && <TableHead className="min-w-36">Source cible</TableHead>}
                {events && isVisible("evenement") && <TableHead className="min-w-48">Événement</TableHead>}
                {fields.map((f) => isVisible(`custom:${f.key}`) && (
                  <TableHead key={f.id} className="min-w-36">
                    {f.label}
                  </TableHead>
                ))}
                {isVisible("qty") && <TableHead className="min-w-16">Qté</TableHead>}
                {isVisible("coutAchat") && <TableHead className="min-w-28">Coût achat unit.</TableHead>}
                {isVisible("prixCible") && <TableHead className="min-w-28">Prix cible vente</TableHead>}
                {isVisible("marge") && <TableHead className="min-w-28">Marge</TableHead>}
                {trackPriorite && isVisible("priorite") && <TableHead className="min-w-32">Priorité</TableHead>}
                {trackRecu && isVisible("recu") && <TableHead className="min-w-32">Reçu</TableHead>}
                {isVisible("tvaAchat") && <TableHead className="min-w-24">TVA achat</TableHead>}
                {isVisible("tvaDed") && <TableHead className="min-w-24">TVA déd.</TableHead>}
                {isVisible("dateVente") && <TableHead className="min-w-32">Date de vente</TableHead>}
                {isVisible("dateEncaissement") && <TableHead className="min-w-32">Date encaissement</TableHead>}
                {isVisible("statut") && <TableHead className="min-w-32">Statut</TableHead>}
                {showCompteEmail && isVisible("compteEmail") && <TableHead className="min-w-40">Compte (email)</TableHead>}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((it) => {
                const margeCible =
                  it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
                const tvaDed =
                  it.tauxTvaAchat > 0
                    ? it.qty * it.coutAchatUnit * (it.tauxTvaAchat / (100 + it.tauxTvaAchat))
                    : 0;
                return (
                  <TableRow key={it.id} data-state={selectedIds.has(it.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </StickyTableCell>
                    {showDescription && isVisible("description") && (
                      <TableCell>
                        <InlineTextArea value={it.description ?? ""} onSave={saveField(it.id, "description")} testId="stock-description" />
                      </TableCell>
                    )}
                    {isVisible("source") && (
                      <TableCell>
                        <InlineSelect
                          value={it.source ?? ""}
                          options={sourceOptions}
                          placeholder="Source"
                          onSave={saveField(it.id, "source")}
                        />
                      </TableCell>
                    )}
                    {events && isVisible("evenement") && (
                      <TableCell>
                        <InlineSelect
                          value={it.eventId ?? ""}
                          options={eventOptions}
                          placeholder="Événement"
                          onSave={saveEvent(it.id)}
                        />
                      </TableCell>
                    )}
                    {fields.map((f) => isVisible(`custom:${f.key}`) && (
                      <TableCell key={f.id}>
                        {f.fieldType === "DATE" ? (
                          <InlineDate value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        ) : f.fieldType === "NUMBER" ? (
                          <InlineNumber
                            value={Number(it.customValues?.[f.key] ?? 0)}
                            onSave={saveCustom(it.id, f.key)}
                          />
                        ) : (
                          <InlineTextArea value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        )}
                      </TableCell>
                    ))}
                    {isVisible("qty") && (
                      <TableCell>
                        <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                      </TableCell>
                    )}
                    {isVisible("coutAchat") && (
                      <TableCell>
                        <InlineNumber value={it.coutAchatUnit} onSave={saveField(it.id, "coutAchatUnit")} />
                      </TableCell>
                    )}
                    {isVisible("prixCible") && (
                      <TableCell>
                        <InlineNumber
                          value={it.prixCibleVente ?? 0}
                          onSave={saveField(it.id, "prixCibleVente")}
                        />
                      </TableCell>
                    )}
                    {isVisible("marge") && (
                      <TableCell className="text-center tabular-nums">
                        {margeCible !== null ? eur.format(margeCible) : "—"}
                      </TableCell>
                    )}
                    {trackPriorite && isVisible("priorite") && (
                      <TableCell>
                        <InlineSelect
                          value={it.priorite ?? "NORMAL"}
                          options={PRIORITE_OPTIONS}
                          onSave={saveField(it.id, "priorite")}
                        />
                      </TableCell>
                    )}
                    {trackRecu && isVisible("recu") && (
                      <TableCell>
                        <InlineSelect
                          value={String(it.recu ?? false)}
                          options={RECU_OPTIONS}
                          onSave={saveField(it.id, "recu")}
                        />
                      </TableCell>
                    )}
                    {isVisible("tvaAchat") && (
                      <TableCell>
                        <InlineSelect
                          value={String(it.tauxTvaAchat)}
                          options={tvaOptions}
                          onSave={saveField(it.id, "tauxTvaAchat")}
                        />
                      </TableCell>
                    )}
                    {isVisible("tvaDed") && (
                      <TableCell className="text-center tabular-nums">{eur.format(tvaDed)}</TableCell>
                    )}
                    {isVisible("dateVente") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <InlineDate value={it.dateVente ?? ""} onSave={saveDate(it.id, "dateVente")} />
                          {!it.dateVente && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Marquer vendu aujourd'hui"
                              onClick={() => handleMarkVendu(it.id)}
                            >
                              <PackageCheck className="text-amber-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible("dateEncaissement") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <InlineDate
                            value={it.dateEncaissement ?? ""}
                            onSave={saveDate(it.id, "dateEncaissement")}
                          />
                          {it.dateVente && !it.dateEncaissement && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Marquer encaissé aujourd'hui"
                              onClick={() => handleMarkEncaisse(it.id)}
                            >
                              <CheckCircle2 className="text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible("statut") && (
                      <TableCell>
                        <Badge className={statutBadgeVariant[it.statut]}>{STATUT_LABEL[it.statut]}</Badge>
                      </TableCell>
                    )}
                    {showCompteEmail && isVisible("compteEmail") && (
                      <TableCell>
                        <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />
                      </TableCell>
                    )}
                    <TableCell>
                      <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      17 +
                      fields.length +
                      (trackPriorite ? 1 : 0) +
                      (trackRecu ? 1 : 0) +
                      (events ? 1 : 0) +
                      (showDescription ? 1 : 0) +
                      (showCompteEmail ? 1 : 0)
                    }
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucun article en stock.
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

      {/* Mobile cards : repliées par défaut pour un coup d'œil rapide sur le stock */}
      <div className="flex flex-col gap-2 md:hidden">
        {paginated.map((it) => {
          const margeCible =
            it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
          const isOpen = expanded.has(it.id);
          const prioriteEmoji = trackPriorite
            ? (PRIORITE_OPTIONS.find((o) => o.value === it.priorite)?.label ?? "🟡 Normal").split(" ")[0]
            : null;
          const eventLabel = it.eventId ? eventOptions.find((e) => e.value === it.eventId)?.label : null;

          return (
            <Card key={it.id} className="py-0">
              <div className="flex w-full items-center gap-1 p-3">
                <Checkbox
                  checked={selectedIds.has(it.id)}
                  onCheckedChange={() => toggleSelected(it.id)}
                  className="mr-1 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => toggleExpanded(it.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {prioriteEmoji && <span className="shrink-0 text-base leading-none">{prioriteEmoji}</span>}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {it.description || eventLabel || "Sans description"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {STATUT_LABEL[it.statut]}
                      {eventLabel && it.description ? ` · ${eventLabel}` : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums">
                      {it.prixCibleVente !== null ? eur.format(it.prixCibleVente) : "—"}
                    </span>
                    {margeCible !== null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        +{eur.format(margeCible)}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                  />
                </button>
              </div>

              {isOpen && (
                <CardContent className="flex flex-col gap-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <Badge className={statutBadgeVariant[it.statut]}>{STATUT_LABEL[it.statut]}</Badge>
                    <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                  </div>
                  {showDescription && (
                    <InlineTextArea
                      value={it.description ?? ""}
                      placeholder="Description"
                      onSave={saveField(it.id, "description")}
                      className="text-base font-medium"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Date achat">
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </Field>
                    <Field label="Source cible">
                      <InlineSelect
                        value={it.source ?? ""}
                        options={sourceOptions}
                        placeholder="Source"
                        onSave={saveField(it.id, "source")}
                      />
                    </Field>
                    {events && (
                      <Field label="Événement">
                        <InlineSelect
                          value={it.eventId ?? ""}
                          options={eventOptions}
                          placeholder="Événement"
                          onSave={saveEvent(it.id)}
                        />
                      </Field>
                    )}
                    <Field label="Qté">
                      <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                    </Field>
                    <Field label="Coût achat unit.">
                      <InlineNumber value={it.coutAchatUnit} onSave={saveField(it.id, "coutAchatUnit")} />
                    </Field>
                    <Field label="Prix cible vente">
                      <InlineNumber value={it.prixCibleVente ?? 0} onSave={saveField(it.id, "prixCibleVente")} />
                    </Field>
                    {fields.map((f) => (
                      <Field key={f.id} label={f.label}>
                        {f.fieldType === "DATE" ? (
                          <InlineDate value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        ) : f.fieldType === "NUMBER" ? (
                          <InlineNumber
                            value={Number(it.customValues?.[f.key] ?? 0)}
                            onSave={saveCustom(it.id, f.key)}
                          />
                        ) : (
                          <InlineTextArea value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        )}
                      </Field>
                    ))}
                    {trackPriorite && (
                      <Field label="Priorité">
                        <InlineSelect
                          value={it.priorite ?? "NORMAL"}
                          options={PRIORITE_OPTIONS}
                          onSave={saveField(it.id, "priorite")}
                        />
                      </Field>
                    )}
                    {trackRecu && (
                      <Field label="Reçu">
                        <InlineSelect
                          value={String(it.recu ?? false)}
                          options={RECU_OPTIONS}
                          onSave={saveField(it.id, "recu")}
                        />
                      </Field>
                    )}
                    <Field label="TVA achat">
                      <InlineSelect
                        value={String(it.tauxTvaAchat)}
                        options={tvaOptions}
                        onSave={saveField(it.id, "tauxTvaAchat")}
                      />
                    </Field>
                    {showCompteEmail && (
                      <Field label="Compte (email)">
                        <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />
                      </Field>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-2">
                    <Field label="Date de vente">
                      <div className="flex items-center gap-1">
                        <InlineDate value={it.dateVente ?? ""} onSave={saveDate(it.id, "dateVente")} />
                        {!it.dateVente && (
                          <Button variant="ghost" size="icon-sm" onClick={() => handleMarkVendu(it.id)}>
                            <PackageCheck className="text-amber-600" />
                          </Button>
                        )}
                      </div>
                    </Field>
                    <Field label="Date encaissement">
                      <div className="flex items-center gap-1">
                        <InlineDate
                          value={it.dateEncaissement ?? ""}
                          onSave={saveDate(it.id, "dateEncaissement")}
                        />
                        {it.dateVente && !it.dateEncaissement && (
                          <Button variant="ghost" size="icon-sm" onClick={() => handleMarkEncaisse(it.id)}>
                            <CheckCircle2 className="text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </Field>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun article en stock.</p>
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
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" data-testid="row-actions" />}>
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
