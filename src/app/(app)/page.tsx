import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Ticket, Wrench, ShoppingBag } from "lucide-react";
import { EvolutionChart, type SaleForChart } from "@/components/evolution-chart";

const SEUIL_BIEN = 85000;
const SEUIL_SERVICE = 37500;

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "cat-billets": Ticket,
  "cat-prestations": Wrench,
  "cat-merch": ShoppingBag,
};

export default async function DashboardPage() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [categories, allSales] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.sale.findMany({ include: { category: true } }),
  ]);

  const sales = allSales.filter(
    (s) => s.dateEncaissement && s.dateEncaissement >= startOfYear
  );

  const salesByCategory = new Map<string, typeof sales>();
  for (const s of sales) {
    const arr = salesByCategory.get(s.categoryId) ?? [];
    arr.push(s);
    salesByCategory.set(s.categoryId, arr);
  }

  let caBienEncaisse = 0;
  let caServiceEncaisse = 0;
  let beneficeNetTotal = 0;
  let caEnAttente = 0;

  for (const s of sales) {
    const total = s.qty * Number(s.prixVenteUnit);
    const cout = s.qty * Number(s.coutAchatUnit);
    if (s.statut === "ENCAISSE") {
      if (s.category.kind === "BIEN") caBienEncaisse += total;
      else caServiceEncaisse += total;
      beneficeNetTotal += total - cout;
    } else if (s.statut === "EN_ATTENTE") {
      caEnAttente += total;
    }
  }

  const chartSales: SaleForChart[] = allSales.map((s) => ({
    dateVente: s.dateVente.toISOString().slice(0, 10),
    dateEncaissement: s.dateEncaissement ? s.dateEncaissement.toISOString().slice(0, 10) : null,
    statut: s.statut,
    qty: s.qty,
    prixVenteUnit: Number(s.prixVenteUnit),
    coutAchatUnit: Number(s.coutAchatUnit),
  }));

  const pctBien = Math.min(100, (caBienEncaisse / SEUIL_BIEN) * 100);
  const pctService = Math.min(100, (caServiceEncaisse / SEUIL_SERVICE) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de ton activité, {now.getFullYear()}.
        </p>
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
            <CardTitle className="text-base">
              Seuil TVA · Ventes de biens
            </CardTitle>
            <CardDescription>
              Billets + Merch cumulés (même seuil, franchise en base)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={pctBien} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {eur.format(caBienEncaisse)} / {eur.format(SEUIL_BIEN)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Seuil TVA · Prestations
            </CardTitle>
            <CardDescription>Services (Prestation commerciale)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={pctService} />
            <p className="text-sm text-muted-foreground tabular-nums">
              {eur.format(caServiceEncaisse)} / {eur.format(SEUIL_SERVICE)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Catégories
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map((c) => {
            const Icon = categoryIcons[c.id] ?? Ticket;
            const catSales = salesByCategory.get(c.id) ?? [];
            const encaisse = catSales
              .filter((s) => s.statut === "ENCAISSE")
              .reduce((sum, s) => sum + s.qty * Number(s.prixVenteUnit), 0);
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
                  <p className="text-lg font-semibold tabular-nums">
                    {eur.format(encaisse)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    encaissé cette année
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
