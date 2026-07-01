"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { eur, TVA_RATES } from "@/lib/format";
import {
  createAchatPro,
  updateAchatProField,
  deleteAchatPro,
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
  const [isPending, startTransition] = useTransition();

  const filtered = initialItems.filter((it) => {
    if (!search.trim()) return true;
    const haystack = [it.description, it.categorie, it.notes].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
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

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAchatPro(id, path);
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
                <TableHead className="min-w-32">Date achat</TableHead>
                <TableHead className="min-w-56">Description / Fournisseur</TableHead>
                <TableHead className="min-w-48">Catégorie</TableHead>
                <TableHead className="min-w-16">Qté</TableHead>
                <TableHead className="min-w-28">Montant HT</TableHead>
                <TableHead className="min-w-24">Taux TVA</TableHead>
                <TableHead className="min-w-28">TVA déductible</TableHead>
                <TableHead className="min-w-48">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const total = it.qty * it.montantHt;
                const tvaDed = it.tauxTva > 0 ? total * (it.tauxTva / (100 + it.tauxTva)) : 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </TableCell>
                    <TableCell>
                      <InlineText value={it.description} onSave={saveField(it.id, "description")} testId="achat-description" />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={it.categorie ?? ""}
                        options={categorieOptions}
                        placeholder="Catégorie"
                        onSave={saveField(it.id, "categorie")}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={it.montantHt} onSave={saveField(it.id, "montantHt")} />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={String(it.tauxTva)}
                        options={tvaOptions}
                        onSave={saveField(it.id, "tauxTva")}
                      />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{eur.format(tvaDed)}</TableCell>
                    <TableCell>
                      <InlineText value={it.notes ?? ""} onSave={saveField(it.id, "notes")} />
                    </TableCell>
                    <TableCell>
                      <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun achat pro pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
                  <span className="text-sm font-semibold tabular-nums">{eur.format(total)}</span>
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
                <Field label="Notes">
                  <InlineText value={it.notes ?? ""} onSave={saveField(it.id, "notes")} />
                </Field>
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
