"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/format";
import type { TvaAlertInfo } from "@/lib/tva-alert";

function dismissKey(alert: TvaAlertInfo, today: string) {
  return `tva-alert-dismissed:${alert.kind}:${alert.level}:${today}`;
}

export function TvaAlertBanner({ alerts }: { alerts: TvaAlertInfo[] }) {
  const [today, setToday] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setToday(todayStr);
    setDismissed(
      new Set(
        alerts
          .map((a) => dismissKey(a, todayStr))
          .filter((key) => localStorage.getItem(key) === "1")
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!today) return null;

  const visible = alerts.filter((a) => !dismissed.has(dismissKey(a, today)));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 sm:px-6">
      {visible.map((a) => (
        <div
          key={`${a.kind}-${a.level}`}
          data-testid={`tva-alert-${a.kind}-${a.level}`}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
            a.level === "over"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          )}
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {a.level === "over" ? (
              <>
                Seuil TVA <strong>dépassé</strong> sur {a.label.toLowerCase()} — {eur.format(a.ca)} /{" "}
                {eur.format(a.seuil)}.
              </>
            ) : (
              <>
                Seuil TVA bientôt atteint sur {a.label.toLowerCase()} — {eur.format(a.ca)} /{" "}
                {eur.format(a.seuil)} ({Math.round(a.pct)}%).
              </>
            )}{" "}
            <Link href="/" className="underline underline-offset-2">
              Voir le tableau de bord
            </Link>
          </span>
          <button
            type="button"
            onClick={() => {
              const key = dismissKey(a, today);
              localStorage.setItem(key, "1");
              setDismissed((prev) => new Set(prev).add(key));
            }}
            className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100"
            aria-label="Fermer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
