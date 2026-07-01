import { prisma } from "@/lib/prisma";
import { CATEGORY_ROUTES } from "@/lib/category-routes";
import { AEncaisserList, type AttenteRow } from "@/components/a-encaisser";

export default async function AEncaisserPage() {
  const [stockItems, sales] = await Promise.all([
    prisma.stockItem.findMany({
      where: { deletedAt: null, statut: "EN_ATTENTE" },
      include: { category: true, event: true },
    }),
    prisma.sale.findMany({
      where: { deletedAt: null, dateEncaissement: null },
      include: { category: true, event: true },
    }),
  ]);

  const rows: AttenteRow[] = [
    ...stockItems.map((s) => ({
      id: s.id,
      kind: "stock" as const,
      categoryName: s.category.name,
      categoryColor: s.category.color,
      categoryScope: s.category.scope,
      description: s.description,
      eventLabel: s.event
        ? [s.event.name, s.event.dateEvenement?.toLocaleDateString("fr-FR")].filter(Boolean).join(" — ")
        : null,
      source: s.source,
      dateVente: s.dateVente!.toISOString().slice(0, 10),
      montant: s.qty * Number(s.prixCibleVente ?? 0),
      path: CATEGORY_ROUTES[s.categoryId] ?? "/",
    })),
    ...sales.map((s) => ({
      id: s.id,
      kind: "sale" as const,
      categoryName: s.category.name,
      categoryColor: s.category.color,
      categoryScope: s.category.scope,
      description: s.description,
      eventLabel: s.event
        ? [s.event.name, s.event.dateEvenement?.toLocaleDateString("fr-FR")].filter(Boolean).join(" — ")
        : null,
      source: s.source,
      dateVente: s.dateVente.toISOString().slice(0, 10),
      montant: s.qty * Number(s.prixVenteUnit),
      path: CATEGORY_ROUTES[s.categoryId] ?? "/",
    })),
  ];

  return <AEncaisserList initialRows={rows} />;
}
