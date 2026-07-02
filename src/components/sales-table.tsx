"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, CheckCircle2, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { InlineText, InlineTextArea, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { eur, TVA_RATES } from "@/lib/format";
import { computeSale } from "@/lib/calc";
import { downloadCsv } from "@/lib/export-csv";
import {
  createSale,
  updateSaleField,
  updateSaleCustomValue,
  updateSaleEventId,
  deleteSale,
  restoreSale,
  bulkDeleteSales,
  bulkRestoreSales,
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
  const [sortMode, setSortMode] = useState<"date" | "evenement">("evenement");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useMemo(() => setSales(initialSales), [initialSales]);

  const eventLabelById = new Map((events ?? []).map((e) => [e.id, e.label]));

  const filtered = sales.filter((s) => {
    if (statutFilter !== "ALL" && s.statut !== statutFilter) return false;
    if (!search.trim()) return true;
    const haystack = [
      s.description,
      s.source,
      s.notes,
      s.eventId ? eventLabelById.get(s.eventId) : null,
      ...Object.values(s.customValues ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  if (events && sortMode === "evenement") {
    filtered.sort((a, b) => {
      const la = a.eventId ? eventLabelById.get(a.eventId) ?? "" : "";
      const lb = b.eventId ? eventLabelById.get(b.eventId) ?? "" : "";
      if (la === lb) return 0;
      if (!la) return 1;
      if (!lb) return -1;
      return la.localeCompare(lb);
    });
  }

  const sourceOptions = sources.map((s) => ({ value: s, label: s }));

  function handleAdd() {
    startTransition(async () => {
      try {
        await createSale(categoryId, path);
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
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} ligne{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="min-w-32">Date vente</TableHead>
                <TableHead className="min-w-32">Date encaissement</TableHead>
                <TableHead className="min-w-36">Statut</TableHead>
                <TableHead className="min-w-36">Source</TableHead>
                {events && <TableHead className="min-w-48">Événement</TableHead>}
                {showDescription && <TableHead className="min-w-48">Description</TableHead>}
                {fields.map((f) => (
                  <TableHead key={f.id} className="min-w-36">
                    {f.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-16">Qté</TableHead>
                <TableHead className="min-w-28">Prix vente unit.</TableHead>
                <TableHead className="min-w-28">Coût achat unit.</TableHead>
                <TableHead className="min-w-28">Total encaissé</TableHead>
                <TableHead className="min-w-28">Marge brute</TableHead>
                <TableHead className="min-w-24">TVA vente</TableHead>
                <TableHead className="min-w-24">TVA collectée</TableHead>
                <TableHead className="min-w-24">TVA achat</TableHead>
                <TableHead className="min-w-24">TVA déd.</TableHead>
                <TableHead className="min-w-28">Bénéf. après TVA</TableHead>
                <TableHead className="min-w-48">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const calc = computeSale(s);
                return (
                  <TableRow key={s.id} data-state={selectedIds.has(s.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                    </TableCell>
                    <TableCell>
                      <InlineDate value={s.dateVente} onSave={saveField(s.id, "dateVente")} />
                    </TableCell>
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
                    <TableCell>
                      <InlineSelect
                        value={s.statut}
                        options={STATUT_OPTIONS}
                        onSave={saveField(s.id, "statut")}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={s.source ?? ""}
                        options={sourceOptions}
                        placeholder="Source"
                        onSave={saveField(s.id, "source")}
                      />
                    </TableCell>
                    {events && (
                      <TableCell>
                        <InlineSelect
                          value={s.eventId ?? ""}
                          options={eventOptions}
                          placeholder="Événement"
                          onSave={saveEvent(s.id)}
                        />
                      </TableCell>
                    )}
                    {showDescription && (
                      <TableCell>
                        <InlineText
                          value={s.description ?? ""}
                          onSave={saveField(s.id, "description")}
                          testId="sale-description"
                        />
                      </TableCell>
                    )}
                    {fields.map((f) => (
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
                    <TableCell>
                      <InlineNumber value={s.qty} step="1" onSave={saveField(s.id, "qty")} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={s.prixVenteUnit} onSave={saveField(s.id, "prixVenteUnit")} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={s.coutAchatUnit} onSave={saveField(s.id, "coutAchatUnit")} />
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-medium">
                      {eur.format(calc.totalEncaisse)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {eur.format(calc.margeBrute)}
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={String(s.tauxTvaVente)}
                        options={tvaOptions}
                        onSave={saveField(s.id, "tauxTvaVente")}
                      />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {eur.format(calc.tvaCollectee)}
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={String(s.tauxTvaAchat)}
                        options={tvaOptions}
                        onSave={saveField(s.id, "tauxTvaAchat")}
                      />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {eur.format(calc.tvaDeductibleAchat)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-medium">
                      {eur.format(calc.beneficeNetApresTva)}
                    </TableCell>
                    <TableCell>
                      <InlineTextArea value={s.notes ?? ""} onSave={saveField(s.id, "notes")} />
                    </TableCell>
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
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((s) => {
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
                  <InlineText
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
                <Field label="Notes">
                  <InlineTextArea value={s.notes ?? ""} onSave={saveField(s.id, "notes")} />
                </Field>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune vente pour l&apos;instant.
          </p>
        )}
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
