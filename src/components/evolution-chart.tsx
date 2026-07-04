"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { eur } from "@/lib/format";

const compactEur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type SaleForChart = {
  dateVente: string;
  dateEncaissement: string | null;
  statut: "EN_ATTENTE" | "ENCAISSE" | "LITIGE";
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
};

type Period = "jour" | "3mois" | "mois" | "annee";
type Basis = "encaisse" | "vente";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "jour", label: "Jours" },
  { value: "3mois", label: "3 mois" },
  { value: "mois", label: "Mois" },
  { value: "annee", label: "Année" },
];

function getBuckets(period: Period) {
  const now = new Date();
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

  if (period === "jour") {
    for (let i = 29; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        start,
        end,
      });
    }
  } else if (period === "3mois") {
    for (let i = 12; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        start,
        end,
      });
    }
  } else if (period === "mois") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}`,
        label: start.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        start,
        end,
      });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      buckets.push({
        key: String(y),
        label: String(y),
        start: new Date(y, 0, 1),
        end: new Date(y + 1, 0, 1),
      });
    }
  }

  return buckets;
}

const chartConfig = {
  benefice: {
    label: "Bénéfice net",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function EvolutionChart({ sales }: { sales: SaleForChart[] }) {
  const [period, setPeriod] = useState<Period>("mois");
  const [basis, setBasis] = useState<Basis>("encaisse");

  const data = useMemo(() => {
    const buckets = getBuckets(period);
    const relevant =
      basis === "encaisse"
        ? sales.filter((s) => s.statut === "ENCAISSE" && s.dateEncaissement)
        : sales;

    return buckets.map((b) => {
      let benefice = 0;
      for (const s of relevant) {
        const dateStr = basis === "encaisse" ? s.dateEncaissement : s.dateVente;
        if (!dateStr) continue;
        const date = new Date(`${dateStr}T00:00:00.000Z`);
        if (date >= b.start && date < b.end) {
          benefice += s.qty * s.prixVenteUnit - s.qty * s.coutAchatUnit;
        }
      }
      return { label: b.label, benefice: Math.round(benefice * 100) / 100 };
    });
  }, [sales, period, basis]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Évolution du bénéfice</CardTitle>
          <CardDescription>
            {basis === "encaisse" ? "Basé sur l'encaissement (trésorerie réelle)" : "Basé sur la date de vente (performance commerciale)"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[basis]}
            onValueChange={(v) => v[0] && setBasis(v[0] as Basis)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="encaisse">Encaissé</ToggleGroupItem>
            <ToggleGroupItem value="vente">Vente</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            value={[period]}
            onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}
            variant="outline"
            size="sm"
          >
            {PERIOD_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              fontSize={12}
              tickFormatter={(v) => compactEur.format(Number(v))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => eur.format(Number(value))}
                />
              }
            />
            <defs>
              <linearGradient id="fillBenefice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-benefice)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-benefice)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <Area
              dataKey="benefice"
              type="monotone"
              fill="url(#fillBenefice)"
              stroke="var(--color-benefice)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
