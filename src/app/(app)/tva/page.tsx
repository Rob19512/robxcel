import { prisma } from "@/lib/prisma";
import {
  TvaQuarterly,
  type CategoryLite,
  type SaleLite,
  type StockLite,
  type AchatProLite,
} from "@/components/tva-quarterly";
import { TvaSettings } from "@/components/tva-settings";
import { getAppSettings } from "@/lib/actions/tva-settings-actions";

export default async function TvaPage() {
  const [categories, sales, stockItems, achatsPro, appSettings] = await Promise.all([
    prisma.category.findMany({ where: { scope: "PRO" } }),
    prisma.sale.findMany({
      where: { category: { scope: "PRO" }, deletedAt: null },
      include: { stockItem: true },
    }),
    prisma.stockItem.findMany({ where: { category: { scope: "PRO" }, deletedAt: null } }),
    prisma.achatPro.findMany({ where: { deletedAt: null } }),
    getAppSettings(),
  ]);

  const categoriesLite: CategoryLite[] = categories.map((c) => ({ id: c.id, name: c.name }));
  const tvaCategoriesLite = categories.map((c) => ({
    id: c.id,
    name: c.name,
    defaultTauxTvaVente: c.defaultTauxTvaVente !== null ? Number(c.defaultTauxTvaVente) : null,
    defaultTauxTvaAchat: c.defaultTauxTvaAchat !== null ? Number(c.defaultTauxTvaAchat) : null,
  }));

  const salesLite: SaleLite[] = sales.map((s) => ({
    categoryId: s.categoryId,
    dateVente: s.dateVente.toISOString().slice(0, 10),
    dateEncaissement: s.dateEncaissement ? s.dateEncaissement.toISOString().slice(0, 10) : null,
    statut: s.statut,
    qty: s.qty,
    prixVenteUnit: Number(s.prixVenteUnit),
    coutAchatUnit: Number(s.coutAchatUnit),
    tauxTvaVente: Number(s.tauxTvaVente),
    tauxTvaAchat: Number(s.tauxTvaAchat),
    hasStockOrigin: !!s.stockItem,
  }));

  const stockLite: StockLite[] = stockItems.map((s) => ({
    dateAchat: s.dateAchat.toISOString().slice(0, 10),
    qty: s.qty,
    coutAchatUnit: Number(s.coutAchatUnit),
    tauxTvaAchat: Number(s.tauxTvaAchat),
  }));

  const achatsProLite: AchatProLite[] = achatsPro.map((a) => ({
    dateAchat: a.dateAchat.toISOString().slice(0, 10),
    qty: a.qty,
    montantHt: Number(a.montantHt),
    tauxTva: Number(a.tauxTva),
  }));

  return (
    <div className="flex flex-col gap-6">
      <TvaSettings initialAssujettiDepuis={appSettings.tvaAssujettiDepuis} categories={tvaCategoriesLite} />
      <TvaQuarterly
        categories={categoriesLite}
        sales={salesLite}
        stockItems={stockLite}
        achatsPro={achatsProLite}
      />
    </div>
  );
}
