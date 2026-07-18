"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TVA_RATES } from "@/lib/format";
import { updateTvaAssujettiDepuis } from "@/lib/actions/tva-settings-actions";
import { updateCategoryDefaultTva } from "@/lib/actions/category-actions";

export type TvaCategoryLite = {
  id: string;
  name: string;
  defaultTauxTvaVente: number | null;
  defaultTauxTvaAchat: number | null;
};

const rateOptions = [
  { value: "", label: "—" },
  ...TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` })),
];

export function TvaSettings({
  initialAssujettiDepuis,
  categories,
}: {
  initialAssujettiDepuis: string | null;
  categories: TvaCategoryLite[];
}) {
  const [assujettiDepuis, setAssujettiDepuis] = useState(initialAssujettiDepuis ?? "");
  const [rows, setRows] = useState(categories);
  const [isPending, startTransition] = useTransition();

  function handleSaveDate(value: string) {
    setAssujettiDepuis(value);
    startTransition(async () => {
      try {
        await updateTvaAssujettiDepuis(value || null);
        toast.success(value ? "Date d'assujettissement enregistrée" : "Date effacée - tout redevient 0% par défaut");
      } catch {
        toast.error("Impossible d'enregistrer la date");
      }
    });
  }

  function handleSaveRate(categoryId: string, field: "defaultTauxTvaVente" | "defaultTauxTvaAchat", value: string) {
    const num = value === "" ? null : Number(value);
    setRows((prev) => prev.map((r) => (r.id === categoryId ? { ...r, [field]: num } : r)));
    startTransition(async () => {
      try {
        await updateCategoryDefaultTva(categoryId, field, num);
      } catch {
        toast.error("Impossible d'enregistrer le taux");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Réglages TVA</CardTitle>
        <CardDescription>
          Avant la date ci-dessous, tout reste à 0% quels que soient les taux par défaut
          configurés (ça correspond à la franchise en base). À partir de cette date, chaque
          nouvelle vente/nouvel achat des catégories ci-dessous applique automatiquement son
          taux par défaut, sans avoir à y penser ligne par ligne. Les lignes déjà existantes
          restent inchangées ; modifier une ligne au cas par cas reste toujours possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="tva-assujetti-depuis">Assujetti à la TVA depuis le</Label>
          <Input
            id="tva-assujetti-depuis"
            type="date"
            value={assujettiDepuis}
            onChange={(e) => handleSaveDate(e.target.value)}
            disabled={isPending}
          />
        </div>

        {rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Taux par défaut par catégorie</p>
            <div className="flex flex-col gap-2">
              {rows.map((c) => (
                <div key={c.id} className="grid grid-cols-1 items-center gap-2 rounded-md border p-2.5 sm:grid-cols-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">TVA vente (collectée)</Label>
                    <Select
                      value={c.defaultTauxTvaVente === null ? "" : String(c.defaultTauxTvaVente)}
                      onValueChange={(v) => handleSaveRate(c.id, "defaultTauxTvaVente", v ?? "")}
                      items={rateOptions}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rateOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">TVA achat (déductible)</Label>
                    <Select
                      value={c.defaultTauxTvaAchat === null ? "" : String(c.defaultTauxTvaAchat)}
                      onValueChange={(v) => handleSaveRate(c.id, "defaultTauxTvaAchat", v ?? "")}
                      items={rateOptions}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rateOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
