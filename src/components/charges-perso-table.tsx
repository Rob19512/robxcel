"use client";

import { useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
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
import { InlineText, InlineNumber, InlineDate } from "@/components/inline-field";
import { eur } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createChargePerso,
  updateChargePersoField,
  deleteChargePerso,
  restoreChargePerso,
  bulkDeleteChargesPerso,
  bulkRestoreChargesPerso,
  duplicateChargePerso,
  type ChargePersoField,
} from "@/lib/actions/charge-perso-actions";

export type ChargePersoRow = {
  id: string;
  date: string;
  description: string;
  categorie: string | null;
  qty: number;
  montant: number;
  notes: string | null;
};

export function ChargesPersoTable({ path, initialItems }: { path: string; initialItems: ChargePersoRow[] }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();

  const filtered = initialItems.filter((it) => {
    if (!search.trim()) return true;
    const haystack = normalizeForSearch(
      [it.description, it.categorie, it.notes, String(it.qty), String(it.montant)].join(" ")
    );
    return haystack.includes(normalizeForSearch(search));
  });

  const total = filtered.reduce((sum, it) => sum + it.qty * it.montant, 0);

  function handleAdd() {
    startTransition(async () => {
      try {
        await createChargePerso(path);
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
        await bulkDeleteChargesPerso(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreChargesPerso(ids, path);
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
        await deleteChargePerso(id, path);
        toast.success("Ligne supprimée", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreChargePerso(id, path);
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
        await duplicateChargePerso(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function saveField(id: string, field: ChargePersoField) {
    return (value: string) => updateChargePersoField(id, path, field, value);
  }

  function handleExport() {
    downloadCsv(
      "charges-perso.csv",
      filtered.map((it) => ({
        Date: it.date,
        Description: it.description,
        Catégorie: it.categorie ?? "",
        "Qté": it.qty,
        Montant: it.montant,
        Notes: it.notes ?? "",
      }))
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter une charge
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
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} ligne{filtered.length > 1 ? "s" : ""} · {eur.format(total)}
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
                <StickyTableHead className="min-w-32" stickyClassName={STICKY_COL}>Date</StickyTableHead>
                <TableHead className="min-w-56">Description</TableHead>
                <TableHead className="min-w-48">Catégorie</TableHead>
                <TableHead className="min-w-16">Qté</TableHead>
                <TableHead className="min-w-28">Montant</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => (
                <TableRow key={it.id} data-state={selectedIds.has(it.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                  </TableCell>
                  <StickyTableCell stickyClassName={STICKY_COL}>
                    <InlineDate value={it.date} onSave={saveField(it.id, "date")} />
                  </StickyTableCell>
                  <TableCell>
                    <InlineText value={it.description} onSave={saveField(it.id, "description")} testId="charge-description" />
                  </TableCell>
                  <TableCell>
                    <InlineText value={it.categorie ?? ""} placeholder="Catégorie" onSave={saveField(it.id, "categorie")} />
                  </TableCell>
                  <TableCell>
                    <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                  </TableCell>
                  <TableCell>
                    <InlineNumber value={it.montant} onSave={saveField(it.id, "montant")} />
                  </TableCell>
                  <TableCell>
                    <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Aucune charge perso pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((it) => (
          <Card key={it.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                  <span className="text-sm font-semibold tabular-nums">{eur.format(it.qty * it.montant)}</span>
                </div>
                <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
              </div>
              <InlineText
                value={it.description}
                placeholder="Description"
                onSave={saveField(it.id, "description")}
                className="text-base font-medium"
              />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date">
                  <InlineDate value={it.date} onSave={saveField(it.id, "date")} />
                </Field>
                <Field label="Catégorie">
                  <InlineText value={it.categorie ?? ""} placeholder="Catégorie" onSave={saveField(it.id, "categorie")} />
                </Field>
                <Field label="Qté">
                  <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                </Field>
                <Field label="Montant">
                  <InlineNumber value={it.montant} onSave={saveField(it.id, "montant")} />
                </Field>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune charge perso pour l&apos;instant.</p>
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
