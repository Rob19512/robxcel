import type { Sale } from "@/generated/prisma/client";
import type { SaleRow } from "@/components/sales-table";

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
