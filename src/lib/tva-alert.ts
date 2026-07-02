import { prisma } from "@/lib/prisma";
import { SEUIL_BIEN, SEUIL_SERVICE } from "@/lib/tva-seuils";

export type TvaAlertLevel = "warning" | "over";

export type TvaAlertInfo = {
  kind: "BIEN" | "SERVICE";
  label: string;
  ca: number;
  seuil: number;
  pct: number;
  level: TvaAlertLevel;
};

function levelFor(pct: number): TvaAlertLevel | null {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warning";
  return null;
}

export async function getTvaAlerts(): Promise<TvaAlertInfo[]> {
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const sales = await prisma.sale.findMany({
    where: {
      deletedAt: null,
      statut: "ENCAISSE",
      dateEncaissement: { gte: start, lt: end },
      category: { scope: "PRO" },
    },
    select: { qty: true, prixVenteUnit: true, category: { select: { kind: true } } },
  });

  let caBien = 0;
  let caService = 0;
  for (const s of sales) {
    const total = s.qty * Number(s.prixVenteUnit);
    if (s.category.kind === "BIEN") caBien += total;
    else caService += total;
  }

  const candidates: TvaAlertInfo[] = [
    {
      kind: "BIEN",
      label: "Ventes de biens",
      ca: caBien,
      seuil: SEUIL_BIEN,
      pct: (caBien / SEUIL_BIEN) * 100,
      level: "warning",
    },
    {
      kind: "SERVICE",
      label: "Prestations",
      ca: caService,
      seuil: SEUIL_SERVICE,
      pct: (caService / SEUIL_SERVICE) * 100,
      level: "warning",
    },
  ];

  return candidates.flatMap((c) => {
    const level = levelFor(c.pct);
    return level ? [{ ...c, level }] : [];
  });
}
