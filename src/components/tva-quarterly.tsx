"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur } from "@/lib/format";
import { calculIS, SEUIL_IS_REDUIT, TAUX_IS_REDUIT, TAUX_IS_NORMAL } from "@/lib/is-tax";

export type CategoryLite = { id: string; name: string };

export type SaleLite = {
  categoryId: string;
  dateVente: string;
  dateEncaissement: string | null;
  statut: "EN_ATTENTE" | "ENCAISSE" | "LITIGE";
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
  tauxTvaVente: number;
  tauxTvaAchat: number;
  hasStockOrigin: boolean;
};

export type StockLite = {
  dateAchat: string;
  qty: number;
  coutAchatUnit: number;
  tauxTvaAchat: number;
};

export type AchatProLite = {
  dateAchat: string;
  qty: number;
  montantHt: number;
  tauxTva: number;
};

// Le trimestre couvre toujours ses 3 mois calendaires (T4 = oct-déc, jamais jusqu'à
// janvier) - seule la DATE DE DÉCLARATION tombe ~1 mois après la fin du trimestre, donc
// l'année suivante pour T4. Les deux infos sont affichées séparément pour ne pas laisser
// croire que le trimestre lui-même déborde sur janvier.
const QUARTER_PERIODS = ["1 jan. – 31 mars", "1 avr. – 30 juin", "1 juil. – 30 sept.", "1 oct. – 31 déc."];
const DEADLINE_DATES = ["30/04", "31/07", "31/10", "31/01"];

function tvaFromTtc(montant: number, taux: number) {
  return taux > 0 ? montant * (taux / (100 + taux)) : 0;
}

function inQuarter(dateStr: string, year: number, quarter: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (d.getFullYear() !== year) return false;
  const q = Math.floor(d.getMonth() / 3);
  return q === quarter;
}

export function TvaQuarterly({
  categories,
  sales,
  stockItems,
  achatsPro,
}: {
  categories: CategoryLite[];
  sales: SaleLite[];
  stockItems: StockLite[];
  achatsPro: AchatProLite[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const s of sales) set.add(new Date(`${s.dateVente}T00:00:00.000Z`).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [sales, now]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const quarters = [0, 1, 2, 3].map((q) => {
    const quarterSales = sales.filter(
      (s) => s.statut === "ENCAISSE" && s.dateEncaissement && inQuarter(s.dateEncaissement, year, q)
    );

    const parCategorie = new Map<string, { caHt: number; tvaCollectee: number }>();
    let totalTvaCollectee = 0;

    for (const s of quarterSales) {
      const total = s.qty * s.prixVenteUnit;
      const tva = tvaFromTtc(total, s.tauxTvaVente);
      const caHt = total - tva;
      const cat = categoryById.get(s.categoryId);
      const key = cat?.name ?? "Autre";
      const entry = parCategorie.get(key) ?? { caHt: 0, tvaCollectee: 0 };
      entry.caHt += caHt;
      entry.tvaCollectee += tva;
      parCategorie.set(key, entry);
      totalTvaCollectee += tva;
    }

    const stockDeductible = stockItems
      .filter((s) => inQuarter(s.dateAchat, year, q))
      .reduce((sum, s) => sum + tvaFromTtc(s.qty * s.coutAchatUnit, s.tauxTvaAchat), 0);

    const saleAchatDeductible = sales
      .filter((s) => !s.hasStockOrigin && inQuarter(s.dateVente, year, q))
      .reduce((sum, s) => sum + tvaFromTtc(s.qty * s.coutAchatUnit, s.tauxTvaAchat), 0);

    // montantHt est déjà hors taxe (contrairement aux montants TTC de Sale/StockItem) :
    // la TVA s'ajoute par-dessus, elle ne s'extrait pas du montant - tvaFromTtc donnerait
    // un chiffre trop bas ici (a longtemps sous-estimé la TVA déductible sur les achats pro).
    const achatProDeductible = achatsPro
      .filter((a) => inQuarter(a.dateAchat, year, q))
      .reduce((sum, a) => sum + a.qty * a.montantHt * (a.tauxTva / 100), 0);

    const tvaDeductible = stockDeductible + saleAchatDeductible + achatProDeductible;

    return {
      quarter: q,
      parCategorie: Array.from(parCategorie.entries()),
      totalTvaCollectee,
      tvaDeductible,
      stockDeductible,
      saleAchatDeductible,
      achatProDeductible,
      tvaNette: totalTvaCollectee - tvaDeductible,
    };
  });

  // IS : sur le bénéfice imposable HT de l'année entière (encaissé, Pro), pas trimestre par trimestre.
  const anneeSales = sales.filter(
    (s) => s.statut === "ENCAISSE" && s.dateEncaissement && new Date(`${s.dateEncaissement}T00:00:00.000Z`).getFullYear() === year
  );
  let caHtAnnee = 0;
  let coutHtAnnee = 0;
  for (const s of anneeSales) {
    const totalTtc = s.qty * s.prixVenteUnit;
    caHtAnnee += totalTtc - tvaFromTtc(totalTtc, s.tauxTvaVente);
    const coutTtc = s.qty * s.coutAchatUnit;
    coutHtAnnee += coutTtc - tvaFromTtc(coutTtc, s.tauxTvaAchat);
  }
  const achatsProHtAnnee = achatsPro
    .filter((a) => new Date(`${a.dateAchat}T00:00:00.000Z`).getFullYear() === year)
    .reduce((sum, a) => sum + a.qty * a.montantHt, 0);
  const beneficeImposable = caHtAnnee - coutHtAnnee - achatsProHtAnnee;
  const is = calculIS(beneficeImposable);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TVA & IS</h1>
          <p className="text-sm text-muted-foreground">
            Sur les encaissements, Pro uniquement — année {year}.
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))} items={years.map((y) => ({ value: String(y), label: String(y) }))}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {quarters.map((q) => (
          <Card key={q.quarter}>
            <CardHeader>
              <CardTitle className="text-base">
                T{q.quarter + 1} {year} <span className="font-normal text-muted-foreground">({QUARTER_PERIODS[q.quarter]})</span>
              </CardTitle>
              <CardDescription>
                Déclaration à déposer avant le {DEADLINE_DATES[q.quarter]}/{q.quarter === 3 ? year + 1 : year}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                {q.parCategorie.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun encaissement ce trimestre.</p>
                )}
                {q.parCategorie.map(([name, v]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{name} — CA HT {eur.format(v.caHt)}</span>
                    <span className="tabular-nums">{eur.format(v.tvaCollectee)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">TVA collectée</span>
                <span className="font-medium tabular-nums">{eur.format(q.totalTvaCollectee)}</span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TVA déductible (stock)</span>
                  <span className="tabular-nums">{eur.format(q.stockDeductible)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TVA déductible (ventes directes)</span>
                  <span className="tabular-nums">{eur.format(q.saleAchatDeductible)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TVA déductible (achats pro)</span>
                  <span className="tabular-nums">{eur.format(q.achatProDeductible)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-sm font-medium">TVA nette à reverser</span>
                <span className="text-lg font-semibold tabular-nums">{eur.format(q.tvaNette)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impôt sur les sociétés (IS) — estimation {year}</CardTitle>
          <CardDescription>
            Sur l&apos;année entière (pas trimestre par trimestre), Pro uniquement, encaissé − coût des
            ventes − achats pro. {TAUX_IS_REDUIT * 100} % jusqu&apos;à {eur.format(SEUIL_IS_REDUIT)} de
            bénéfice, {TAUX_IS_NORMAL * 100} % au-delà.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bénéfice imposable</span>
            <span className="tabular-nums">{eur.format(beneficeImposable)}</span>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Tranche à {TAUX_IS_REDUIT * 100} % ({eur.format(is.trancheReduite)})
              </span>
              <span className="tabular-nums">{eur.format(is.isReduit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Tranche à {TAUX_IS_NORMAL * 100} % ({eur.format(is.trancheNormale)})
              </span>
              <span className="tabular-nums">{eur.format(is.isNormal)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-sm font-medium">IS estimé à payer</span>
            <span className="text-lg font-semibold tabular-nums">{eur.format(is.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
