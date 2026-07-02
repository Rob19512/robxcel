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
import { Badge } from "@/components/ui/badge";
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
import { SEUIL_BIEN, SEUIL_SERVICE } from "@/lib/tva-seuils";
import { cn } from "@/lib/utils";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";

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
  color: string | null;
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

export type ChargeLite = {
  date: string;
  qty: number;
  montant: number;
};

export type AchatProLite = {
  date: string;
  qty: number;
  montant: number;
};

function DualStat({
  vendu,
  encaisse,
  showVendu,
  showEncaisse,
  venduLabel = "Vendu",
  encaisseLabel = "Encaissé",
  size = "text-xl",
  valueClassName,
}: {
  vendu: number;
  encaisse: number;
  showVendu: boolean;
  showEncaisse: boolean;
  venduLabel?: string;
  encaisseLabel?: string;
  size?: string;
  valueClassName?: string;
}) {
  if (showVendu && showEncaisse) {
    return (
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={cn(size, "font-semibold tabular-nums", valueClassName)}>{eur.format(vendu)}</p>
          <p className="text-xs text-muted-foreground">{venduLabel}</p>
        </div>
        <div className="text-right">
          <p className={cn(size, "font-semibold tabular-nums", valueClassName ?? "text-primary")}>{eur.format(encaisse)}</p>
          <p className="text-xs text-muted-foreground">{encaisseLabel}</p>
        </div>
      </div>
    );
  }
  const value = showVendu ? vendu : encaisse;
  const label = showVendu ? venduLabel : encaisseLabel;
  return (
    <div>
      <p className={cn(size, "font-semibold tabular-nums", valueClassName ?? (showEncaisse && "text-primary"))}>
        {eur.format(value)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

const BENEFICE_COLOR = "text-emerald-600 dark:text-emerald-500";
const CHARGE_COLOR = "text-destructive";

function yearMonthOf(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function Dashboard({
  categories,
  sales,
  charges,
  achatsPro,
}: {
  categories: CategoryLite[];
  sales: SaleLite[];
  charges: ChargeLite[];
  achatsPro: AchatProLite[];
}) {
  const now = new Date();
  const [scope, setScope] = useState<"PRO" | "PERSO" | "ALL">("PRO");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth());
  const [viewMode, setViewMode] = useState<"vendu" | "encaisse" | "both">("both");
  const showVendu = viewMode !== "encaisse";
  const showEncaisse = viewMode !== "vendu";
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();

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

  // Vendu = toutes les ventes de la période (peu importe si encaissé), performance commerciale.
  function inVenduPeriod(s: SaleLite) {
    const ym = yearMonthOf(s.dateVente);
    if (ym.year !== year) return false;
    if (month !== null && ym.month !== month) return false;
    return true;
  }

  // Encaissé = trésorerie réelle : uniquement ce qui est vraiment arrivé sur le compte cette période.
  function inEncaissePeriod(s: SaleLite) {
    if (s.statut !== "ENCAISSE" || !s.dateEncaissement) return false;
    const ym = yearMonthOf(s.dateEncaissement);
    if (ym.year !== year) return false;
    if (month !== null && ym.month !== month) return false;
    return true;
  }

  const periodSalesVendu = useMemo(() => scopedSales.filter(inVenduPeriod), [scopedSales, year, month]);
  const periodSalesEncaisse = useMemo(() => scopedSales.filter(inEncaissePeriod), [scopedSales, year, month]);

  // Toutes catégories confondues (indépendant du filtre Pro/Perso), pour que chaque section
  // reste visible avec son propre bénéfice quel que soit le filtre choisi en haut.
  const periodSalesAllScopesVendu = useMemo(() => sales.filter(inVenduPeriod), [sales, year, month]);
  const periodSalesAllScopesEncaisse = useMemo(() => sales.filter(inEncaissePeriod), [sales, year, month]);

  let caBienVendu = 0;
  let caServiceVendu = 0;
  let beneficeVendu = 0;
  let caEnAttente = 0;

  for (const s of periodSalesVendu) {
    const cat = categoryById.get(s.categoryId);
    if (!cat) continue;
    const total = s.qty * s.prixVenteUnit;
    const cout = s.qty * s.coutAchatUnit;
    if (cat.kind === "BIEN") caBienVendu += total;
    else caServiceVendu += total;
    beneficeVendu += total - cout;
    if (s.statut === "EN_ATTENTE") caEnAttente += total;
  }

  let caBienEncaisse = 0;
  let caServiceEncaisse = 0;
  let beneficeNetTotal = 0;

  for (const s of periodSalesEncaisse) {
    const cat = categoryById.get(s.categoryId);
    if (!cat) continue;
    const total = s.qty * s.prixVenteUnit;
    const cout = s.qty * s.coutAchatUnit;
    if (cat.kind === "BIEN") caBienEncaisse += total;
    else caServiceEncaisse += total;
    beneficeNetTotal += total - cout;
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

  // Charges perso : hors seuils TVA/IS, juste un total dépenses sur la période affichée.
  const totalCharges = useMemo(() => {
    return charges
      .filter((c) => {
        const ym = yearMonthOf(c.date);
        if (ym.year !== year) return false;
        if (month !== null && ym.month !== month) return false;
        return true;
      })
      .reduce((sum, c) => sum + c.qty * c.montant, 0);
  }, [charges, year, month]);

  // Achats pro : dépenses déductibles de la SASU (mêmes montants HT que pour l'IS), à
  // soustraire du bénéfice net — uniquement quand la vue inclut le Pro.
  const totalAchatsPro = useMemo(() => {
    return achatsPro
      .filter((a) => {
        const ym = yearMonthOf(a.date);
        if (ym.year !== year) return false;
        if (month !== null && ym.month !== month) return false;
        return true;
      })
      .reduce((sum, a) => sum + a.qty * a.montant, 0);
  }, [achatsPro, year, month]);

  const achatsProDeduction = scope !== "PERSO" ? totalAchatsPro : 0;
  const beneficeVenduNet = beneficeVendu - achatsProDeduction;
  const beneficeNetTotalNet = beneficeNetTotal - achatsProDeduction;

  const pctBien = Math.min(100, (caBienProAnnee / SEUIL_BIEN) * 100);
  const pctService = Math.min(100, (caServiceProAnnee / SEUIL_SERVICE) * 100);

  // Récap mensuel : combien vendu (performance) vs combien réellement encaissé (ce qui compte
  // pour la TVA/impôts), mois par mois sur l'année sélectionnée — indépendant du filtre mois ci-dessus.
  const monthlyRecap = useMemo(() => {
    const achatsProByMonth = new Map<number, number>();
    if (scope !== "PERSO") {
      for (const a of achatsPro) {
        const ym = yearMonthOf(a.date);
        if (ym.year !== year) continue;
        achatsProByMonth.set(ym.month, (achatsProByMonth.get(ym.month) ?? 0) + a.qty * a.montant);
      }
    }
    return MONTHS.map((label, m) => {
      let venduCA = 0;
      let venduBenefice = 0;
      let encaisseCA = 0;
      let encaisseBenefice = 0;
      for (const s of scopedSales) {
        const total = s.qty * s.prixVenteUnit;
        const cout = s.qty * s.coutAchatUnit;
        const ymVente = yearMonthOf(s.dateVente);
        if (ymVente.year === year && ymVente.month === m) {
          venduCA += total;
          venduBenefice += total - cout;
        }
        if (s.statut === "ENCAISSE" && s.dateEncaissement) {
          const ymEnc = yearMonthOf(s.dateEncaissement);
          if (ymEnc.year === year && ymEnc.month === m) {
            encaisseCA += total;
            encaisseBenefice += total - cout;
          }
        }
      }
      const achatsProMonth = achatsProByMonth.get(m) ?? 0;
      venduBenefice -= achatsProMonth;
      encaisseBenefice -= achatsProMonth;
      return { label, venduCA, venduBenefice, encaisseCA, encaisseBenefice };
    });
  }, [scopedSales, achatsPro, year, scope]);

  const monthlyTotals = monthlyRecap.reduce(
    (acc, m) => ({
      venduCA: acc.venduCA + m.venduCA,
      venduBenefice: acc.venduBenefice + m.venduBenefice,
      encaisseCA: acc.encaisseCA + m.encaisseCA,
      encaisseBenefice: acc.encaisseBenefice + m.encaisseBenefice,
    }),
    { venduCA: 0, venduBenefice: 0, encaisseCA: 0, encaisseBenefice: 0 }
  );

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
          <ToggleGroup
            value={[viewMode]}
            onValueChange={(v) => v[0] && setViewMode(v[0] as typeof viewMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="vendu">Vendu</ToggleGroupItem>
            <ToggleGroupItem value="encaisse">Encaissé</ToggleGroupItem>
            <ToggleGroupItem value="both">Les deux</ToggleGroupItem>
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
            <CardDescription>Bénéfice net</CardDescription>
          </CardHeader>
          <CardContent>
            <DualStat
              vendu={beneficeVenduNet}
              encaisse={beneficeNetTotalNet}
              showVendu={showVendu}
              showEncaisse={showEncaisse}
              valueClassName={BENEFICE_COLOR}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA biens</CardDescription>
          </CardHeader>
          <CardContent>
            <DualStat vendu={caBienVendu} encaisse={caBienEncaisse} showVendu={showVendu} showEncaisse={showEncaisse} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA prestations</CardDescription>
          </CardHeader>
          <CardContent>
            <DualStat vendu={caServiceVendu} encaisse={caServiceEncaisse} showVendu={showVendu} showEncaisse={showEncaisse} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA en attente d&apos;encaissement</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {eur.format(caEnAttente)}
            </CardTitle>
          </CardHeader>
        </Card>
        {scope !== "PERSO" && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Achats pro</CardDescription>
              <CardTitle className={cn("text-2xl font-semibold tabular-nums", CHARGE_COLOR)}>
                {eur.format(totalAchatsPro)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {scope !== "PRO" && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Charges perso</CardDescription>
              <CardTitle className={cn("text-2xl font-semibold tabular-nums", CHARGE_COLOR)}>
                {eur.format(totalCharges)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
      {viewMode === "both" && (
        <p className="-mt-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Vendu</strong> = toutes les ventes de la période, encaissées ou pas ·{" "}
          <strong className="text-foreground">Encaissé</strong> = argent réellement arrivé sur la période.
        </p>
      )}
      {scope !== "PERSO" && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Le bénéfice net ci-dessus est déjà net des achats pro ({eur.format(totalAchatsPro)} déduits sur la période).
        </p>
      )}

      <EvolutionChart sales={chartSales} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Récap mensuel {year}</CardTitle>
          <CardDescription>
            Vendu = performance commerciale du mois · Encaissé = ce qui compte pour ta TVA/tes impôts
            (uniquement l&apos;argent réellement arrivé ce mois-là, même si la vente date d&apos;avant).
          </CardDescription>
        </CardHeader>
        <CardContent ref={scrollRef} className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Mois</th>
                {showVendu && (
                  <>
                    <th className="px-3 py-2 text-right font-medium">CA vendu</th>
                    <th className={cn("px-3 py-2 text-right font-medium", BENEFICE_COLOR)}>Bénéf. vendu</th>
                  </>
                )}
                {showEncaisse && (
                  <>
                    <th className="px-3 py-2 text-right font-medium text-primary">CA encaissé</th>
                    <th className={cn("px-4 py-2 text-right font-medium", BENEFICE_COLOR)}>Bénéf. encaissé</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {monthlyRecap.map((m, i) => (
                <tr
                  key={m.label}
                  className={cn("border-b last:border-0", i === month && "bg-accent/50")}
                >
                  <td className="px-4 py-1.5 font-medium">{m.label}</td>
                  {showVendu && (
                    <>
                      <td className="px-3 py-1.5 text-right tabular-nums">{eur.format(m.venduCA)}</td>
                      <td className={cn("px-3 py-1.5 text-right tabular-nums", BENEFICE_COLOR)}>{eur.format(m.venduBenefice)}</td>
                    </>
                  )}
                  {showEncaisse && (
                    <>
                      <td className="px-3 py-1.5 text-right tabular-nums text-primary">{eur.format(m.encaisseCA)}</td>
                      <td className={cn("px-4 py-1.5 text-right tabular-nums", BENEFICE_COLOR)}>
                        {eur.format(m.encaisseBenefice)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="px-4 py-2">Total {year}</td>
                {showVendu && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(monthlyTotals.venduCA)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", BENEFICE_COLOR)}>{eur.format(monthlyTotals.venduBenefice)}</td>
                  </>
                )}
                {showEncaisse && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums text-primary">
                      {eur.format(monthlyTotals.encaisseCA)}
                    </td>
                    <td className={cn("px-4 py-2 text-right tabular-nums", BENEFICE_COLOR)}>
                      {eur.format(monthlyTotals.encaisseBenefice)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

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
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Catégories (toutes, quel que soit le filtre Pro/Perso ci-dessus)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map((c) => {
            const Icon = categoryIcons[c.id] ?? Ticket;
            const catSalesVendu = periodSalesAllScopesVendu.filter((s) => s.categoryId === c.id);
            const catSalesEncaisse = periodSalesAllScopesEncaisse.filter((s) => s.categoryId === c.id);
            const caVendu = catSalesVendu.reduce((sum, s) => sum + s.qty * s.prixVenteUnit, 0);
            const beneficeVenduCat = catSalesVendu.reduce(
              (sum, s) => sum + (s.qty * s.prixVenteUnit - s.qty * s.coutAchatUnit),
              0
            );
            const caEncaisseCat = catSalesEncaisse.reduce((sum, s) => sum + s.qty * s.prixVenteUnit, 0);
            const beneficeEncaisseCat = catSalesEncaisse.reduce(
              (sum, s) => sum + (s.qty * s.prixVenteUnit - s.qty * s.coutAchatUnit),
              0
            );
            const color = c.color;
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <div
                    className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                    style={color ? { backgroundColor: `${color}1a`, color } : undefined}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {c.name}
                      <Badge variant="secondary" className="text-[10px]">
                        {c.scope === "PRO" ? "Pro" : "Perso"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {c.kind === "BIEN" ? "Bien" : "Service"}
                      {c.hasStock ? " · avec stock" : ""}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {showVendu && (
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold tabular-nums">{eur.format(caVendu)}</p>
                        <p className="text-xs text-muted-foreground">CA vendu</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-base font-semibold tabular-nums", BENEFICE_COLOR)}>{eur.format(beneficeVenduCat)}</p>
                        <p className="text-xs text-muted-foreground">Bénéf. vendu</p>
                      </div>
                    </div>
                  )}
                  {showEncaisse && (
                    <div className={cn("flex items-end justify-between gap-2", showVendu && "border-t pt-2")}>
                      <div>
                        <p className="text-base font-semibold tabular-nums text-primary">
                          {eur.format(caEncaisseCat)}
                        </p>
                        <p className="text-xs text-muted-foreground">CA encaissé</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-base font-semibold tabular-nums", BENEFICE_COLOR)}>
                          {eur.format(beneficeEncaisseCat)}
                        </p>
                        <p className="text-xs text-muted-foreground">Bénéf. encaissé</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
