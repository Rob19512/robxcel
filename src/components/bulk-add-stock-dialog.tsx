"use client";

import { useState, useTransition, type ClipboardEvent } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { toast } from "sonner";
import { Plus, Trash2, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkCreateStockItems, type BulkStockRowInput } from "@/lib/actions/stock-actions";
import type { CategoryFieldDef, EventOption } from "@/components/sales-table";

const PRIORITE_OPTIONS = [
  { value: "", label: "—" },
  { value: "URGENT", label: "🔴 Urgent" },
  { value: "NORMAL", label: "🟡 Normal" },
  { value: "PAS_PRESSE", label: "🟢 Pas pressé" },
];

const RECU_OPTIONS = [
  { value: "", label: "—" },
  { value: "true", label: "🟢 Reçu" },
  { value: "false", label: "🔴 Pas reçu" },
];

type DraftRow = {
  dateAchat: string;
  description: string;
  source: string;
  eventName: string;
  customValues: Record<string, string>;
  qty: string;
  coutAchatUnit: string;
  prixCibleVente: string;
  priorite: "" | "URGENT" | "NORMAL" | "PAS_PRESSE";
  recu: "" | "true" | "false";
  compteEmail: string;
  notes: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyRow(): DraftRow {
  return {
    dateAchat: today(),
    description: "",
    source: "",
    eventName: "",
    customValues: {},
    qty: "1",
    coutAchatUnit: "",
    prixCibleVente: "",
    priorite: "",
    recu: "",
    compteEmail: "",
    notes: "",
  };
}

export function BulkAddStockDialog({
  categoryId,
  path,
  fields,
  trackPriorite,
  trackRecu,
  events,
}: {
  categoryId: string;
  path: string;
  fields: CategoryFieldDef[];
  trackPriorite: boolean;
  trackRecu: boolean;
  events?: EventOption[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(() => Array.from({ length: 6 }, emptyRow));
  const [isPending, startTransition] = useTransition();
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();

  // Ordre des colonnes "collables" (paste positionnel façon Excel).
  const pasteColumns: Array<{ key: keyof DraftRow; customKey?: string }> = [
    { key: "dateAchat" },
    { key: "description" },
    { key: "source" },
    ...(events ? [{ key: "eventName" as const }] : []),
    ...fields.map((f) => ({ key: "customValues" as const, customKey: f.key })),
    { key: "qty" },
    { key: "coutAchatUnit" },
    { key: "prixCibleVente" },
    { key: "compteEmail" },
    { key: "notes" },
  ];

  function updateRow(rowIndex: number, key: keyof DraftRow, value: string, customKey?: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      if (key === "customValues" && customKey) {
        row.customValues = { ...row.customValues, [customKey]: value };
      } else {
        (row as Record<string, unknown>)[key] = value;
      }
      next[rowIndex] = row;
      return next;
    });
  }

  function addRows(n: number) {
    setRows((prev) => [...prev, ...Array.from({ length: n }, emptyRow)]);
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // paste simple, comportement natif
    e.preventDefault();

    const pastedRows = text.replace(/\r/g, "").split("\n").filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ""));

    setRows((prev) => {
      const next = [...prev];
      pastedRows.forEach((line, i) => {
        const targetRowIndex = rowIndex + i;
        while (next.length <= targetRowIndex) next.push(emptyRow());
        const cells = line.split("\t");
        const row = { ...next[targetRowIndex] };
        cells.forEach((cellValue, j) => {
          const col = pasteColumns[colIndex + j];
          if (!col) return;
          if (col.key === "customValues" && col.customKey) {
            row.customValues = { ...row.customValues, [col.customKey]: cellValue.trim() };
          } else {
            (row as Record<string, unknown>)[col.key] = cellValue.trim();
          }
        });
        next[targetRowIndex] = row;
      });
      return next;
    });
  }

  function colIndexOf(key: keyof DraftRow, customKey?: string) {
    return pasteColumns.findIndex((c) => c.key === key && c.customKey === customKey);
  }

  // Une ligne est "remplie" si l'utilisateur y a mis quelque chose (au-delà de la date,
  // pré-remplie par défaut) - sert à ignorer les lignes vides plutôt que les compter comme
  // des erreurs "sans événement".
  function isRowFilled(r: DraftRow) {
    return (
      r.description.trim() !== "" ||
      r.source.trim() !== "" ||
      r.eventName.trim() !== "" ||
      r.coutAchatUnit.trim() !== "" ||
      r.prixCibleVente.trim() !== "" ||
      Object.values(r.customValues).some((v) => v.trim() !== "")
    );
  }

  function handleSubmit() {
    const eventByLabel = new Map((events ?? []).map((e) => [e.label.trim().toLowerCase(), e.id]));

    if (events) {
      const missing = rows.filter((r) => isRowFilled(r) && !eventByLabel.has(r.eventName.trim().toLowerCase()));
      if (missing.length > 0) {
        toast.error(
          `${missing.length} ligne${missing.length > 1 ? "s" : ""} sans événement valide - un événement est obligatoire pour chaque billet.`
        );
        return;
      }
    }

    const payload: BulkStockRowInput[] = rows.map((r) => ({
      dateAchat: r.dateAchat,
      description: r.description,
      source: r.source,
      eventId: r.eventName.trim() ? eventByLabel.get(r.eventName.trim().toLowerCase()) ?? null : null,
      qty: Number(r.qty) || 1,
      coutAchatUnit: Number(r.coutAchatUnit) || 0,
      prixCibleVente: r.prixCibleVente.trim() ? Number(r.prixCibleVente) : null,
      priorite: r.priorite || null,
      recu: r.recu === "" ? null : r.recu === "true",
      compteEmail: r.compteEmail,
      notes: r.notes,
      customValues: r.customValues,
    }));

    startTransition(async () => {
      try {
        const { count } = await bulkCreateStockItems(categoryId, path, payload);
        if (count === 0) {
          toast.error("Aucune ligne remplie à ajouter");
          return;
        }
        toast.success(`${count} article${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""} au stock`);
        setOpen(false);
        setRows(Array.from({ length: 6 }, emptyRow));
      } catch {
        toast.error("Impossible d'ajouter les lignes");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Table2 />
        Ajouter en masse
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-full max-w-[95vw] overflow-y-auto sm:max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Ajout en masse</DialogTitle>
            <DialogDescription>
              Remplis les lignes à la main, ou colle directement plusieurs lignes copiées depuis Excel/Sheets
              (colle dans n&apos;importe quelle case, ça se répartit automatiquement).
              {events && " L'événement est obligatoire pour chaque ligne et doit correspondre exactement à un événement déjà créé."}
            </DialogDescription>
          </DialogHeader>

          <div ref={scrollRef} className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="min-w-32 p-2 text-left font-medium">Date achat</th>
                  <th className="min-w-48 p-2 text-left font-medium">Description</th>
                  <th className="min-w-32 p-2 text-left font-medium">Source</th>
                  {events && <th className="min-w-40 p-2 text-left font-medium">Événement</th>}
                  {fields.map((f) => (
                    <th key={f.id} className="min-w-32 p-2 text-left font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="w-20 p-2 text-left font-medium">Qté</th>
                  <th className="min-w-28 p-2 text-left font-medium">Coût achat</th>
                  <th className="min-w-28 p-2 text-left font-medium">Prix cible</th>
                  {trackPriorite && <th className="min-w-28 p-2 text-left font-medium">Priorité</th>}
                  {trackRecu && <th className="min-w-24 p-2 text-left font-medium">Reçu</th>}
                  <th className="min-w-36 p-2 text-left font-medium">Compte (email)</th>
                  <th className="min-w-40 p-2 text-left font-medium">Notes</th>
                  <th className="w-10 p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b last:border-0">
                    <td className="p-1">
                      <Input
                        type="date"
                        value={row.dateAchat}
                        onChange={(e) => updateRow(rowIndex, "dateAchat", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("dateAchat"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(rowIndex, "description", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("description"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.source}
                        onChange={(e) => updateRow(rowIndex, "source", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("source"))}
                        className="h-8"
                      />
                    </td>
                    {events && (
                      <td className="p-1">
                        <Input
                          value={row.eventName}
                          onChange={(e) => updateRow(rowIndex, "eventName", e.target.value)}
                          onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("eventName"))}
                          className="h-8"
                        />
                      </td>
                    )}
                    {fields.map((f) => (
                      <td key={f.id} className="p-1">
                        <Input
                          value={row.customValues[f.key] ?? ""}
                          onChange={(e) => updateRow(rowIndex, "customValues", e.target.value, f.key)}
                          onPaste={(e) =>
                            handlePaste(e, rowIndex, colIndexOf("customValues", f.key))
                          }
                          className="h-8"
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <Input
                        type="number"
                        value={row.qty}
                        onChange={(e) => updateRow(rowIndex, "qty", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("qty"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        value={row.coutAchatUnit}
                        onChange={(e) => updateRow(rowIndex, "coutAchatUnit", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("coutAchatUnit"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        value={row.prixCibleVente}
                        onChange={(e) => updateRow(rowIndex, "prixCibleVente", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("prixCibleVente"))}
                        className="h-8"
                      />
                    </td>
                    {trackPriorite && (
                      <td className="p-1">
                        <Select
                          value={row.priorite}
                          onValueChange={(v) => v != null && updateRow(rowIndex, "priorite", v)}
                          items={PRIORITE_OPTIONS}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    {trackRecu && (
                      <td className="p-1">
                        <Select
                          value={row.recu}
                          onValueChange={(v) => v != null && updateRow(rowIndex, "recu", v)}
                          items={RECU_OPTIONS}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECU_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="p-1">
                      <Input
                        value={row.compteEmail}
                        onChange={(e) => updateRow(rowIndex, "compteEmail", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("compteEmail"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.notes}
                        onChange={(e) => updateRow(rowIndex, "notes", e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, colIndexOf("notes"))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => removeRow(rowIndex)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={() => addRows(6)} className="w-fit">
            <Plus />
            6 lignes
          </Button>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleSubmit} disabled={isPending}>
              Ajouter au stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
