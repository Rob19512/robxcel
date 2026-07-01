import { prisma } from "@/lib/prisma";
import { Dashboard, type CategoryLite, type SaleLite } from "@/components/dashboard";

export default async function DashboardPage() {
  const [categories, sales] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.sale.findMany(),
  ]);

  const categoriesLite: CategoryLite[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    scope: c.scope,
    hasStock: c.hasStock,
  }));

  const salesLite: SaleLite[] = sales.map((s) => ({
    categoryId: s.categoryId,
    dateVente: s.dateVente.toISOString().slice(0, 10),
    dateEncaissement: s.dateEncaissement ? s.dateEncaissement.toISOString().slice(0, 10) : null,
    statut: s.statut,
    qty: s.qty,
    prixVenteUnit: Number(s.prixVenteUnit),
    coutAchatUnit: Number(s.coutAchatUnit),
  }));

  return <Dashboard categories={categoriesLite} sales={salesLite} />;
}
