"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, PackageCheck, CheckCircle2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { eur, TVA_RATES } from "@/lib/format";
import {
  createStockItem,
  updateStockField,
  updateStockCustomValue,
  updateStockDate,
  deleteStockItem,
  duplicateStockItem,
  markStockVenduToday,
  markStockEncaisseToday,
  type StockCoreField,
} from "@/lib/actions/stock-actions";
import type { CategoryFieldDef } from "@/components/sales-table";

export type StockRow = {
  id: string;
  dateAchat: string;
  description: string | null;
  source: string | null;
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
}: {
  categoryId: string;
  path: string;
  initialItems: StockRow[];
  fields: CategoryFieldDef[];
  sources: string[];
  trackPriorite: boolean;
  trackRecu: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [isPending, startTransition] = useTransition();

  const items = initialItems;
  const sourceOptions = sources.map((s) => ({ value: s, label: s }));

  const filtered = items.filter((it) => {
    if (!showSold && it.statut === "VENDU") return false;
    if (!search.trim()) return true;
    const haystack = [it.description, it.source, it.notes, it.compteEmail, ...Object.values(it.customValues ?? {})]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  function handleAdd() {
    startTransition(async () => {
      try {
        await createStockItem(categoryId, path);
      } catch {
        toast.error("Impossible d'ajouter la ligne");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteStockItem(id, path);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter en stock
        </Button>
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
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} article{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">Date achat</TableHead>
                <TableHead className="min-w-48">Description</TableHead>
                <TableHead className="min-w-36">Source cible</TableHead>
                {fields.map((f) => (
                  <TableHead key={f.id} className="min-w-36">
                    {f.label}
                  </TableHead>
                ))}
                <TableHead className="w-20">Qté</TableHead>
                <TableHead className="min-w-28">Coût achat unit.</TableHead>
                <TableHead className="min-w-28">Prix cible vente</TableHead>
                <TableHead className="min-w-28">Marge cible</TableHead>
                {trackPriorite && <TableHead className="min-w-32">Priorité</TableHead>}
                {trackRecu && <TableHead className="min-w-32">Reçu</TableHead>}
                <TableHead className="min-w-24">TVA achat</TableHead>
                <TableHead className="min-w-24">TVA déd.</TableHead>
                <TableHead className="min-w-32">Date de vente</TableHead>
                <TableHead className="min-w-32">Date encaissement</TableHead>
                <TableHead className="min-w-32">Statut</TableHead>
                <TableHead className="min-w-40">Compte (email)</TableHead>
                <TableHead className="min-w-48">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const margeCible =
                  it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
                const tvaDed =
                  it.tauxTvaAchat > 0
                    ? it.qty * it.coutAchatUnit * (it.tauxTvaAchat / (100 + it.tauxTvaAchat))
                    : 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </TableCell>
                    <TableCell>
                      <InlineText value={it.description ?? ""} onSave={saveField(it.id, "description")} testId="stock-description" />
                    </TableCell>
                    <TableCell>
                      <InlineSelect
                        value={it.source ?? ""}
                        options={sourceOptions}
                        placeholder="Source"
                        onSave={saveField(it.id, "source")}
                      />
                    </TableCell>
                    {fields.map((f) => (
                      <TableCell key={f.id}>
                        {f.fieldType === "DATE" ? (
                          <InlineDate value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        ) : f.fieldType === "NUMBER" ? (
                          <InlineNumber
                            value={Number(it.customValues?.[f.key] ?? 0)}
                            onSave={saveCustom(it.id, f.key)}
                          />
                        ) : (
                          <InlineText value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={it.coutAchatUnit} onSave={saveField(it.id, "coutAchatUnit")} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber
                        value={it.prixCibleVente ?? 0}
                        onSave={saveField(it.id, "prixCibleVente")}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {margeCible !== null ? eur.format(margeCible) : "—"}
                    </TableCell>
                    {trackPriorite && (
                      <TableCell>
                        <InlineSelect
                          value={it.priorite ?? "NORMAL"}
                          options={PRIORITE_OPTIONS}
                          onSave={saveField(it.id, "priorite")}
                        />
                      </TableCell>
                    )}
                    {trackRecu && (
                      <TableCell>
                        <InlineSelect
                          value={String(it.recu ?? false)}
                          options={RECU_OPTIONS}
                          onSave={saveField(it.id, "recu")}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <InlineSelect
                        value={String(it.tauxTvaAchat)}
                        options={tvaOptions}
                        onSave={saveField(it.id, "tauxTvaAchat")}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{eur.format(tvaDed)}</TableCell>
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
                    <TableCell>
                      <Badge className={statutBadgeVariant[it.statut]}>{STATUT_LABEL[it.statut]}</Badge>
                    </TableCell>
                    <TableCell>
                      <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />
                    </TableCell>
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
                  <TableCell
                    colSpan={16 + fields.length + (trackPriorite ? 1 : 0) + (trackRecu ? 1 : 0)}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucun article en stock.
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
          const margeCible =
            it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
          return (
            <Card key={it.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Badge className={statutBadgeVariant[it.statut]}>{STATUT_LABEL[it.statut]}</Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {margeCible !== null ? eur.format(margeCible) : "—"}
                    </span>
                    <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                  </div>
                </div>
                <InlineText
                  value={it.description ?? ""}
                  placeholder="Description"
                  onSave={saveField(it.id, "description")}
                  className="text-base font-medium"
                />
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
                        <InlineText value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
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
                  <Field label="Compte (email)">
                    <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />
                  </Field>
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
                <Field label="Notes">
                  <InlineText value={it.notes ?? ""} onSave={saveField(it.id, "notes")} />
                </Field>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun article en stock.</p>
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
