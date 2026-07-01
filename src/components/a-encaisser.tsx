"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineDate } from "@/components/inline-field";
import { eur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateStockDate } from "@/lib/actions/stock-actions";
import { updateSaleField } from "@/lib/actions/sale-actions";

export type AttenteRow = {
  id: string;
  kind: "stock" | "sale";
  categoryName: string;
  categoryColor: string | null;
  categoryScope: "PRO" | "PERSO";
  description: string | null;
  eventLabel: string | null;
  source: string | null;
  dateVente: string;
  montant: number;
  path: string;
};

export function AEncaisserList({ initialRows }: { initialRows: AttenteRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();

  useMemo(() => setRows(initialRows), [initialRows]);

  const sorted = [...rows].sort((a, b) => a.dateVente.localeCompare(b.dateVente));
  const total = sorted.reduce((sum, r) => sum + r.montant, 0);

  function saveDate(row: AttenteRow) {
    return async (value: string) => {
      if (row.kind === "stock") {
        await updateStockDate(row.id, row.path, "dateEncaissement", value || null);
      } else {
        await updateSaleField(row.id, row.path, "dateEncaissement", value || null);
      }
    };
  }

  function handleMarkToday(row: AttenteRow) {
    startTransition(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (row.kind === "stock") {
          await updateStockDate(row.id, row.path, "dateEncaissement", today);
        } else {
          await updateSaleField(row.id, row.path, "dateEncaissement", today);
        }
        toast.success("Marqué encaissé aujourd'hui");
      } catch {
        toast.error("Erreur");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">À encaisser</h1>
        <p className="text-sm text-muted-foreground">
          {sorted.length} vente{sorted.length > 1 ? "s" : ""} en attente de paiement, toutes catégories
          confondues — {eur.format(total)} au total.
        </p>
      </div>

      {sorted.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Rien en attente d&apos;encaissement — tout est à jour. 🎉
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((row) => {
          const color = row.categoryColor;
          return (
            <Card key={`${row.kind}-${row.id}`}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
                    >
                      {row.categoryName}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {row.categoryScope === "PRO" ? "Pro" : "Perso"}
                    </Badge>
                    {row.source && <span className="text-xs text-muted-foreground">{row.source}</span>}
                  </div>
                  <span className="text-sm font-medium">
                    {row.description || "Sans description"}
                    {row.eventLabel ? ` — ${row.eventLabel}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Vendu le {row.dateVente.split("-").reverse().join("/")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold tabular-nums">{eur.format(row.montant)}</span>
                  <InlineDate value="" onSave={saveDate(row)} className="w-36" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Marquer encaissé aujourd'hui"
                    disabled={isPending}
                    onClick={() => handleMarkToday(row)}
                  >
                    <CheckCircle2 className="text-emerald-600" />
                  </Button>
                  <Link
                    href={row.path}
                    title="Voir la fiche"
                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                  >
                    <ArrowRight />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
