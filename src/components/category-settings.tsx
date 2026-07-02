"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineText } from "@/components/inline-field";
import {
  updateCategoryField,
  deleteCategory,
  createCategoryField,
  deleteCategoryField,
  createCategorySource,
  deleteCategorySource,
  type CategoryCoreField,
} from "@/lib/actions/category-actions";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#64748b",
];

const KIND_OPTIONS = [
  { value: "BIEN", label: "Bien (seuil 85 000 €)" },
  { value: "SERVICE", label: "Service (seuil 37 500 €)" },
];

const SCOPE_OPTIONS = [
  { value: "PRO", label: "Pro" },
  { value: "PERSO", label: "Perso" },
];

export type CategorySettingsData = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  kind: "BIEN" | "SERVICE";
  scope: "PRO" | "PERSO";
  hasStock: boolean;
  trackPriorite: boolean;
  trackRecu: boolean;
  trackEvents: boolean;
  showDescription: boolean;
  fields: { id: string; label: string; fieldType: "TEXT" | "NUMBER" | "DATE" }[];
  sources: { id: string; label: string }[];
};

export function CategorySettings({ category, path }: { category: CategorySettingsData; path: string }) {
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "NUMBER" | "DATE">("TEXT");
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function saveField(field: CategoryCoreField) {
    return (value: string) => updateCategoryField(category.id, path, field, value);
  }

  function handleDeleteCategory() {
    if (
      !confirm(
        `Supprimer définitivement la catégorie "${category.name}" ? Elle doit être vide (aucune vente ni stock).`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteCategory(category.id);
        toast.success("Catégorie supprimée");
        router.push("/categories");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Impossible de supprimer");
      }
    });
  }

  function handleAddField() {
    if (!newFieldLabel.trim()) return;
    startTransition(async () => {
      try {
        await createCategoryField(category.id, path, newFieldLabel, newFieldType);
        setNewFieldLabel("");
        toast.success("Champ ajouté");
      } catch {
        toast.error("Impossible d'ajouter le champ");
      }
    });
  }

  function handleDeleteField(id: string) {
    startTransition(async () => {
      try {
        await deleteCategoryField(id, path);
      } catch {
        toast.error("Impossible de supprimer le champ");
      }
    });
  }

  function handleAddSource() {
    if (!newSourceLabel.trim()) return;
    startTransition(async () => {
      try {
        await createCategorySource(category.id, path, newSourceLabel);
        setNewSourceLabel("");
        toast.success("Source ajoutée");
      } catch {
        toast.error("Impossible d'ajouter la source");
      }
    });
  }

  function handleDeleteSource(id: string) {
    startTransition(async () => {
      try {
        await deleteCategorySource(id, path);
      } catch {
        toast.error("Impossible de supprimer la source");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nom</Label>
            <InlineText
              value={category.name}
              onSave={saveField("name")}
              className="border-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Emoji</Label>
              <InlineText
                value={category.emoji ?? ""}
                onSave={saveField("emoji")}
                className="border-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => saveField("color")(c)}
                    className="size-6 rounded-full ring-offset-2"
                    style={{
                      backgroundColor: c,
                      outline: category.color === c ? `2px solid ${c}` : undefined,
                      outlineOffset: 2,
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={category.kind} onValueChange={(v) => v && saveField("kind")(v)} items={KIND_OPTIONS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Pro ou Perso</Label>
              <Select value={category.scope} onValueChange={(v) => v && saveField("scope")(v)} items={SCOPE_OPTIONS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={category.hasStock}
                onCheckedChange={(v) => saveField("hasStock")(String(!!v))}
              />
              Suivre un stock (achat avant vente)
            </label>
            {category.hasStock && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={category.trackPriorite}
                    onCheckedChange={(v) => saveField("trackPriorite")(String(!!v))}
                  />
                  Suivre une priorité de vente (🔴🟡🟢)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={category.trackRecu}
                    onCheckedChange={(v) => saveField("trackRecu")(String(!!v))}
                  />
                  Suivre si l&apos;article a été reçu
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={category.trackEvents}
                onCheckedChange={(v) => saveField("trackEvents")(String(!!v))}
              />
              Rattacher à des événements (nom + date + lieu, ex. concerts)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={category.showDescription}
                onCheckedChange={(v) => saveField("showDescription")(String(!!v))}
              />
              Garder le champ Description (désactive si tu ne le remplis jamais)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Champs personnalisés</CardTitle>
          <CardDescription>Texte, nombre ou date — visibles dans la saisie et le stock.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {category.fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                {f.label}{" "}
                <span className="text-xs text-muted-foreground">
                  ({f.fieldType === "TEXT" ? "texte" : f.fieldType === "NUMBER" ? "nombre" : "date"})
                </span>
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteField(f.id)} disabled={isPending}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
          {category.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun champ personnalisé pour l&apos;instant.</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nom du champ (ex: Marque)"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              className="h-8"
            />
            <Select value={newFieldType} onValueChange={(v) => v && setNewFieldType(v as typeof newFieldType)} items={[{value:"TEXT",label:"Texte"},{value:"NUMBER",label:"Nombre"},{value:"DATE",label:"Date"}]}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Texte</SelectItem>
                <SelectItem value="NUMBER">Nombre</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAddField}
              disabled={isPending || !newFieldLabel.trim()}
              data-testid="add-field-button"
            >
              <Plus />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources</CardTitle>
          <CardDescription>Les options proposées dans le champ Source (ex: Vinted, Client direct...).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {category.sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{s.label}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSource(s.id)} disabled={isPending}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
          {category.sources.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune source pour l&apos;instant.</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nom de la source (ex: Vinted)"
              value={newSourceLabel}
              onChange={(e) => setNewSourceLabel(e.target.value)}
              className="h-8"
            />
            <Button
              size="sm"
              onClick={handleAddSource}
              disabled={isPending || !newSourceLabel.trim()}
              data-testid="add-source-button"
            >
              <Plus />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Zone dangereuse</CardTitle>
          <CardDescription>
            Supprime définitivement cette catégorie. Impossible si elle contient encore des ventes ou du
            stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={handleDeleteCategory} disabled={isPending}>
            <Trash2 />
            Supprimer la catégorie
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
