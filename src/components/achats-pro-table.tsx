"use client";

import { useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnPrefs, type ColumnDef } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, Download } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { eur, TVA_RATES } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createAchatPro,
  updateAchatProField,
  deleteAchatPro,
  restoreAchatPro,
  bulkDeleteAchatsPro,
  bulkRestoreAchatsPro,
  duplicateAchatPro,
  type AchatProField,
} from "@/lib/actions/achat-pro-actions";

export type AchatProRow = {
  id: string;
  dateAchat: string;
  description: string;
  categorie: string | null;
  qty: number;
  montantHt: number;
  tauxTva: number;
  notes: string | null;
};

export const ACHAT_PRO_CATEGORIES = [
  "Téléphone & internet",
  "Transport",
  "Matériel & équipement",
  "Logiciels & abonnements",
  "Frais bancaires",
  "Comptabilité & juridique",
  "Marketing & pub",
  "Autres frais",
];

const categorieOptions = ACHAT_PRO_CATEGORIES.map((c) => ({ value: c, label: c }));
const tvaOptions = TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` }));

export function AchatsProTable({ path, initialItems }: { path: string; initialItems: AchatProRow[] }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const columnKeys = ["description", "categorie", "qty", "montantHt", "tauxTva", "tvaDed"];
  const { order, isVisible, toggle: toggleColumn, move: moveColumn } = useColumnPrefs("achats-pro", columnKeys);
  const columns: ColumnDef[] = [
    { key: "description", label: "Description / Fournisseur" },
    { key: "categorie", label: "Catégorie" },
    { key: "qty", label: "Qté" },
    { key: "montantHt", label: "Montant HT" },
    { key: "tauxTva", label: "Taux TVA" },
    { key: "tvaDed", label: "TVA déductible" },
  ];
  const visibleOrderedKeys = order.filter(isVisible);
  const labelByKey = new Map(columns.map((c) => [c.key, c.label]));
  function headClassName(key: string) {
    const widths: Record<string, string> = {
      description: "min-w-56",
      categorie: "min-w-48",
      qty: "min-w-16",
      montantHt: "min-w-28",
      tauxTva: "min-w-24",
      tvaDed: "min-w-28",
    };
    return widths[key] ?? "min-w-36";
  }
  function renderBodyCell(key: string, it: AchatProRow, tvaDed: number) {
    switch (key) {
      case "description":
        return <InlineText value={it.description} onSave={saveField(it.id, "description")} testId="achat-description" />;
      case "categorie":
        return (
          <InlineSelect value={it.categorie ?? ""} options={categorieOptions} placeholder="Catégorie" onSave={saveField(it.id, "categorie")} />
        );
      case "qty":
        return <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />;
      case "montantHt":
        return <InlineNumber value={it.montantHt} onSave={saveField(it.id, "montantHt")} />;
      case "tauxTva":
        return <InlineSelect value={String(it.tauxTva)} options={tvaOptions} onSave={saveField(it.id, "tauxTva")} />;
      case "tvaDed":
        return eur.format(tvaDed);
      default:
        return null;
    }
  }

  const filtered = initialItems.filter((it) => {
    if (!search.trim()) return true;
    const haystack = normalizeForSearch(
      [it.description, it.categorie, it.notes, String(it.qty), String(it.montantHt)].join(" ")
    );
    return haystack.includes(normalizeForSearch(search));
  });

  function handleAdd() {
    startTransition(async () => {
      try {
        await createAchatPro(path);
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
        await bulkDeleteAchatsPro(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreAchatsPro(ids, path);
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
        await deleteAchatPro(id, path);
        toast.success("Ligne supprimée", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreAchatPro(id, path);
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
        await duplicateAchatPro(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function saveField(id: string, field: AchatProField) {
    return (value: string) => updateAchatProField(id, path, field, value);
  }

  function handleExport() {
    downloadCsv(
      "achats-pro.csv",
      filtered.map((it) => {
        const tvaDed = it.tauxTva > 0 ? it.qty * it.montantHt * (it.tauxTva / (100 + it.tauxTva)) : 0;
        return {
          "Date achat": it.dateAchat,
          "Description / Fournisseur": it.description,
          Catégorie: it.categorie ?? "",
          "Qté": it.qty,
          "Montant HT": it.montantHt,
          "Taux TVA": it.tauxTva,
          "TVA déductible": tvaDed,
          Notes: it.notes ?? "",
        };
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter un achat
        </Button>
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download />
          Exporter CSV
        </Button>
        <ColumnVisibilityMenu columns={columns} order={order} isVisible={isVisible} toggle={toggleColumn} move={moveColumn} />
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
                <StickyTableHead className="min-w-32" stickyClassName={STICKY_COL}>Date achat</StickyTableHead>
                {visibleOrderedKeys.map((key) => (
                  <TableHead key={key} className={headClassName(key)}>
                    {labelByKey.get(key)}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const total = it.qty * it.montantHt;
                const tvaDed = it.tauxTva > 0 ? total * (it.tauxTva / (100 + it.tauxTva)) : 0;
                return (
                  <TableRow key={it.id} data-state={selectedIds.has(it.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </StickyTableCell>
                    {visibleOrderedKeys.map((key) => (
                      <TableCell key={key} className={key === "tvaDed" ? "text-center tabular-nums" : undefined}>
                        {renderBodyCell(key, it, tvaDed)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun achat pro pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((it) => {
          const total = it.qty * it.montantHt;
          const tvaDed = it.tauxTva > 0 ? total * (it.tauxTva / (100 + it.tauxTva)) : 0;
          return (
            <Card key={it.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                    <span className="text-sm font-semibold tabular-nums">{eur.format(total)}</span>
                  </div>
                  <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                </div>
                <InlineText
                  value={it.description}
                  placeholder="Description / Fournisseur"
                  onSave={saveField(it.id, "description")}
                  className="text-base font-medium"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date achat">
                    <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                  </Field>
                  <Field label="Catégorie">
                    <InlineSelect
                      value={it.categorie ?? ""}
                      options={categorieOptions}
                      placeholder="Catégorie"
                      onSave={saveField(it.id, "categorie")}
                    />
                  </Field>
                  <Field label="Qté">
                    <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                  </Field>
                  <Field label="Montant HT">
                    <InlineNumber value={it.montantHt} onSave={saveField(it.id, "montantHt")} />
                  </Field>
                  <Field label="Taux TVA">
                    <InlineSelect
                      value={String(it.tauxTva)}
                      options={tvaOptions}
                      onSave={saveField(it.id, "tauxTva")}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">TVA déductible</span>
                  <span className="font-semibold tabular-nums">{eur.format(tvaDed)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun achat pro pour l&apos;instant.</p>
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
