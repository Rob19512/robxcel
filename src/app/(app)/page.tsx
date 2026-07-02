import { prisma } from "@/lib/prisma";
import { Dashboard, type CategoryLite, type SaleLite, type ChargeLite, type AchatProLite } from "@/components/dashboard";

export default async function DashboardPage() {
  const [categories, sales, pendingStock, charges, achatsPro] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.sale.findMany({ where: { deletedAt: null } }),
    // Articles déjà vendus (date de vente remplie) mais pas encore encaissés : tant que
    // l'encaissement n'est pas saisi, ils n'existent qu'en StockItem, jamais en Sale.
    // Sans ça, le dashboard "Vendu" les ignore complètement.
    prisma.stockItem.findMany({ where: { deletedAt: null, statut: "EN_ATTENTE" } }),
    prisma.chargePerso.findMany({ where: { deletedAt: null } }),
    prisma.achatPro.findMany({ where: { deletedAt: null } }),
  ]);

  const categoriesLite: CategoryLite[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    scope: c.scope,
    hasStock: c.hasStock,
    color: c.color,
  }));

  const salesLite: SaleLite[] = [
    ...sales.map((s) => ({
      categoryId: s.categoryId,
      dateVente: s.dateVente.toISOString().slice(0, 10),
      dateEncaissement: s.dateEncaissement ? s.dateEncaissement.toISOString().slice(0, 10) : null,
      statut: s.statut,
      qty: s.qty,
      prixVenteUnit: Number(s.prixVenteUnit),
      coutAchatUnit: Number(s.coutAchatUnit),
    })),
    ...pendingStock.map((s) => ({
      categoryId: s.categoryId,
      dateVente: s.dateVente!.toISOString().slice(0, 10),
      dateEncaissement: null,
      statut: "EN_ATTENTE" as const,
      qty: s.qty,
      prixVenteUnit: Number(s.prixCibleVente ?? 0),
      coutAchatUnit: Number(s.coutAchatUnit),
    })),
  ];

  const chargesLite: ChargeLite[] = charges.map((c) => ({
    date: c.date.toISOString().slice(0, 10),
    qty: c.qty,
    montant: Number(c.montant),
  }));

  const achatsProLite: AchatProLite[] = achatsPro.map((a) => ({
    date: a.dateAchat.toISOString().slice(0, 10),
    qty: a.qty,
    montant: Number(a.montantHt),
  }));

  return (
    <Dashboard
      categories={categoriesLite}
      sales={salesLite}
      charges={chargesLite}
      achatsPro={achatsProLite}
    />
  );
}
