import type { Sale, StockItem } from "@/generated/prisma/client";
import type { SaleRow } from "@/components/sales-table";
import type { StockRow } from "@/components/stock-table";

function toDateString(date: Date | null) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export function serializeSale(sale: Sale): SaleRow {
  return {
    id: sale.id,
    dateVente: toDateString(sale.dateVente) ?? "",
    dateEncaissement: toDateString(sale.dateEncaissement),
    source: sale.source,
    statut: sale.statut,
    description: sale.description,
    qty: sale.qty,
    prixVenteUnit: Number(sale.prixVenteUnit),
    coutAchatUnit: Number(sale.coutAchatUnit),
    tauxTvaVente: Number(sale.tauxTvaVente),
    tauxTvaAchat: Number(sale.tauxTvaAchat),
    notes: sale.notes,
    customValues: (sale.customValues as Record<string, string>) ?? {},
  };
}

export function serializeStockItem(item: StockItem): StockRow {
  return {
    id: item.id,
    dateAchat: toDateString(item.dateAchat) ?? "",
    description: item.description,
    source: item.source,
    qty: item.qty,
    coutAchatUnit: Number(item.coutAchatUnit),
    prixCibleVente: item.prixCibleVente !== null ? Number(item.prixCibleVente) : null,
    priorite: item.priorite,
    recu: item.recu,
    tauxTvaAchat: Number(item.tauxTvaAchat),
    dateVente: toDateString(item.dateVente),
    dateEncaissement: toDateString(item.dateEncaissement),
    statut: item.statut,
    compteEmail: item.compteEmail,
    notes: item.notes,
    customValues: (item.customValues as Record<string, string>) ?? {},
  };
}
