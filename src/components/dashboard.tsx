"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Ticket, Wrench, ShoppingBag } from "lucide-react";
import { EvolutionChart, type SaleForChart } from "@/components/evolution-chart";
import { eur } from "@/lib/format";

const SEUIL_BIEN = 85000;
const SEUIL_SERVICE = 37500;

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "cat-billets": Ticket,
  "cat-prestations": Wrench,
  "cat-merch": ShoppingBag,
  "cat-perso-billets": Ticket,
  "cat-perso-prestations": Wrench,
  "cat-perso-merch": ShoppingBag,
};

export type CategoryLite = {
  id: string;
  name: string;
  kind: "BIEN" | "SERVICE";
  scope: "PRO" | "PERSO";
  hasStock: boolean;
};

export type SaleLite = {
  categoryId: string;
  dateVente: string;
  dateEncaissement: string | null;
  statut: "EN_ATTENTE" | "ENCAISSE" | "LITIGE";
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
};

function yearMonthOf(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function Dashboard({
  categories,
  sales,
}: {
  categories: CategoryLite[];
  sales: SaleLite[];
}) {
  const now = new Date();
  const [scope, setScope] = useState<"PRO" | "PERSO" | "ALL">("PRO");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const s of sales) set.add(yearMonthOf(s.dateVente).year);
    return Array.from(set).sort((a, b) => b - a);
  }, [sales, now]);

  const scopedSales = useMemo(() => {
    return sales.filter((s) => {
      const cat = categoryById.get(s.categoryId);
      if (!cat) return false;
      if (scope === "ALL") return true;
      return cat.scope === scope;
    });
  }, [sales, categoryById, scope]);

  const periodSales = useMemo(() => {
    return scopedSales.filter((s) => {
      const ymVente = yearMonthOf(s.dateVente);
      const ymEnc = s.dateEncaissement ? yearMonthOf(s.dateEncaissement) : null;
      const refYm = s.statut === "ENCAISSE" && ymEnc ? ymEnc : ymVente;
      if (refYm.year !== year) return false;
      if (month !== null && refYm.month !== month) return false;
      return true;
    });
  }, [scopedSales, year, month]);

  let caBienEncaisse = 0;
  let caServiceEncaisse = 0;
  let beneficeNetTotal = 0;
  let caEnAttente = 0;

  for (const s of periodSales) {
    const cat = categoryById.get(s.categoryId);
    if (!cat) continue;
    const total = s.qty * s.prixVenteUnit;
    const cout = s.qty * s.coutAchatUnit;
    if (s.statut === "ENCAISSE") {
      if (cat.kind === "BIEN") caBienEncaisse += total;
      else caServiceEncaisse += total;
      beneficeNetTotal += total - cout;
    } else if (s.statut === "EN_ATTENTE") {
      caEnAttente += total;
    }
  }

  // Seuils TVA : toujours Pro uniquement, sur l'année sélectionnée (peu importe le mois/scope choisis ailleurs)
  let caBienProAnnee = 0;
  let caServiceProAnnee = 0;
  for (const s of sales) {
    const cat = categoryById.get(s.categoryId);
    if (!cat || cat.scope !== "PRO") continue;
    if (s.statut !== "ENCAISSE" || !s.dateEncaissement) continue;
    if (yearMonthOf(s.dateEncaissement).year !== year) continue;
    const total = s.qty * s.prixVenteUnit;
    if (cat.kind === "BIEN") caBienProAnnee += total;
    else caServiceProAnnee += total;
  }

  const pctBien = Math.min(100, (caBienProAnnee / SEUIL_BIEN) * 100);
  const pctService = Math.min(100, (caServiceProAnnee / SEUIL_SERVICE) * 100);

  const chartSales: SaleForChart[] = scopedSales;

  const periodLabel = month !== null ? `${MONTHS[month]} ${year}` : `Année ${year}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de ton activité — {periodLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[scope]}
            onValueChange={(v) => v[0] && setScope(v[0] as typeof scope)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="PRO">Pro</ToggleGroupItem>
            <ToggleGroupItem value="PERSO">Perso</ToggleGroupItem>
            <ToggleGroupItem value="ALL">Tout</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={month === null ? "ALL" : String(month)}
            onValueChange={(v) => setMonth(v === "ALL" || !v ? null : Number(v))}
            items={[{ value: "ALL", label: "Toute l'année" }, ...MONTHS.map((m, i) => ({ value: String(i), label: m }))]}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toute l&apos;année</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => v && setYear(Number(v))}
            items={years.map((y) => ({ value: String(y), label: String(y) }))}
          >
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bénéfice net total</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {eur.format(beneficeNetTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA encaissé (biens)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {eur.format(caBienEncaisse)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA encaissé (prestations)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {eur.format(caServiceEncaisse)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA en attente d&apos;encaissement</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {eur.format(caEnAttente)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <EvolutionChart sales={chartSales} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seuil TVA · Ventes de biens</CardTitle>
            <CardDescription>
              Billets + Merch cumulés, Pro uniquement, année {year} (même si le filtre ci-dessus est sur Perso/Tout)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={pctBien} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {eur.format(caBienProAnnee)} / {eur.format(SEUIL_BIEN)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seuil TVA · Prestations</CardTitle>
            <CardDescription>Pro uniquement, année {year}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={pctService} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {eur.format(caServiceProAnnee)} / {eur.format(SEUIL_SERVICE)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Catégories</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories
            .filter((c) => scope === "ALL" || c.scope === scope)
            .map((c) => {
              const Icon = categoryIcons[c.id] ?? Ticket;
              const encaisse = periodSales
                .filter((s) => s.categoryId === c.id && s.statut === "ENCAISSE")
                .reduce((sum, s) => sum + s.qty * s.prixVenteUnit, 0);
              return (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <CardDescription>
                        {c.kind === "BIEN" ? "Bien" : "Service"}
                        {c.hasStock ? " · avec stock" : ""}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold tabular-nums">{eur.format(encaisse)}</p>
                    <p className="text-xs text-muted-foreground">encaissé sur la période</p>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
