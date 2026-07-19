import type { Sale, StockItem, AchatPro, ChargePerso, Event } from "@/generated/prisma/client";
import type { SaleRow } from "@/components/sales-table";
import type { StockRow } from "@/components/stock-table";
import type { AchatProRow } from "@/components/achats-pro-table";
import type { ChargePersoRow } from "@/components/charges-perso-table";
import type { EventRow } from "@/components/events-table";

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
    eventId: sale.eventId,
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
    eventId: item.eventId,
    qty: item.qty,
    coutAchatUnit: Number(item.coutAchatUnit),
    prixCibleVente: item.prixCibleVente !== null ? Number(item.prixCibleVente) : null,
    priorite: item.priorite,
    recu: item.recu,
    tauxTvaAchat: Number(item.tauxTvaAchat),
    tauxTvaVente: Number(item.tauxTvaVente),
    dateVente: toDateString(item.dateVente),
    dateEncaissement: toDateString(item.dateEncaissement),
    statut: item.statut,
    compteEmail: item.compteEmail,
    notes: item.notes,
    customValues: (item.customValues as Record<string, string>) ?? {},
  };
}

export function serializeAchatPro(item: AchatPro): AchatProRow {
  return {
    id: item.id,
    dateAchat: toDateString(item.dateAchat) ?? "",
    description: item.description,
    categorie: item.categorie,
    qty: item.qty,
    montantHt: Number(item.montantHt),
    tauxTva: Number(item.tauxTva),
    notes: item.notes,
  };
}

export function serializeChargePerso(item: ChargePerso): ChargePersoRow {
  return {
    id: item.id,
    date: toDateString(item.date) ?? "",
    description: item.description,
    categorie: item.categorie,
    qty: item.qty,
    montant: Number(item.montant),
    notes: item.notes,
  };
}

export function serializeEvent(event: Event): EventRow {
  return {
    id: event.id,
    name: event.name,
    dateEvenement: toDateString(event.dateEvenement),
    lieuSalle: event.lieuSalle,
    notes: event.notes,
    folderId: event.folderId,
  };
}
