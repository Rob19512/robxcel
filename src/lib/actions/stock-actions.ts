"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categoryRoute, A_ENCAISSER_PATH } from "@/lib/category-routes";

export type StockCoreField =
  | "dateAchat"
  | "description"
  | "source"
  | "qty"
  | "coutAchatUnit"
  | "prixCibleVente"
  | "priorite"
  | "recu"
  | "tauxTvaAchat"
  | "compteEmail"
  | "notes";

function toDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createStockItem(categoryId: string, path: string) {
  await prisma.stockItem.create({
    data: {
      categoryId,
      dateAchat: new Date(),
      qty: 1,
      coutAchatUnit: 0,
    },
  });
  revalidatePath(path);
}

export type BulkStockRowInput = {
  dateAchat: string;
  description: string;
  source: string;
  eventId: string | null;
  qty: number;
  coutAchatUnit: number;
  prixCibleVente: number | null;
  priorite: "URGENT" | "NORMAL" | "PAS_PRESSE" | null;
  recu: boolean | null;
  compteEmail: string;
  notes: string;
  customValues: Record<string, string>;
};

export async function bulkCreateStockItems(categoryId: string, path: string, rows: BulkStockRowInput[]) {
  const valid = rows.filter(
    (r) => r.description.trim() || r.source.trim() || r.coutAchatUnit > 0 || r.prixCibleVente
  );
  if (valid.length === 0) return { count: 0 };

  await prisma.stockItem.createMany({
    data: valid.map((r) => ({
      categoryId,
      dateAchat: toDate(r.dateAchat) ?? new Date(),
      description: r.description.trim() || null,
      source: r.source.trim() || null,
      eventId: r.eventId,
      qty: Math.max(1, r.qty || 1),
      coutAchatUnit: r.coutAchatUnit || 0,
      prixCibleVente: r.prixCibleVente,
      priorite: r.priorite,
      recu: r.recu,
      compteEmail: r.compteEmail.trim() || null,
      notes: r.notes.trim() || null,
      customValues: r.customValues ?? {},
    })),
  });
  revalidatePath(path);
  return { count: valid.length };
}

export async function updateStockField(
  id: string,
  path: string,
  field: StockCoreField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "dateAchat":
      if (value && !toDate(value)) return; // date invalide reçue du client : on ignore plutôt que d'écraser la vraie date
      data.dateAchat = toDate(value) ?? new Date();
      break;
    case "qty":
      data.qty = Math.max(1, Number(value) || 1);
      break;
    case "coutAchatUnit":
    case "prixCibleVente":
    case "tauxTvaAchat":
      data[field] = Number(value) || 0;
      break;
    case "priorite":
      data.priorite = value || null;
      break;
    case "recu":
      data.recu = value === "true";
      break;
    case "source":
    case "description":
    case "compteEmail":
    case "notes":
      data[field] = value || null;
      break;
  }

  await prisma.stockItem.update({ where: { id }, data });
  revalidatePath(path);
}

export async function updateStockEventId(id: string, path: string, eventId: string | null) {
  await prisma.stockItem.update({ where: { id }, data: { eventId } });
  revalidatePath(path);
}

export async function updateStockCustomValue(
  id: string,
  path: string,
  key: string,
  value: string
) {
  const item = await prisma.stockItem.findUniqueOrThrow({ where: { id } });
  const customValues = { ...(item.customValues as Record<string, string>), [key]: value };
  await prisma.stockItem.update({ where: { id }, data: { customValues } });
  revalidatePath(path);
}

export async function updateStockDate(
  id: string,
  path: string,
  field: "dateVente" | "dateEncaissement",
  value: string | null
) {
  if (value && !toDate(value)) return; // date invalide reçue du client : on ignore plutôt que de corrompre le statut
  const item = await prisma.stockItem.findUniqueOrThrow({ where: { id } });
  const date = toDate(value);

  if (field === "dateVente") {
    const statut = item.dateEncaissement ? "VENDU" : date ? "EN_ATTENTE" : "EN_STOCK";
    await prisma.stockItem.update({ where: { id }, data: { dateVente: date, statut } });
  } else {
    if (date && !item.saleId) {
      const sale = await prisma.sale.create({
        data: {
          categoryId: item.categoryId,
          dateVente: item.dateVente ?? date,
          dateEncaissement: date,
          source: item.source,
          eventId: item.eventId,
          statut: "ENCAISSE",
          description: item.description,
          qty: item.qty,
          prixVenteUnit: item.prixCibleVente ?? 0,
          coutAchatUnit: item.coutAchatUnit,
          tauxTvaAchat: item.tauxTvaAchat,
          notes: item.notes ? `${item.notes} (Depuis Stock)` : "Depuis Stock",
          customValues: item.customValues as object,
        },
      });
      await prisma.stockItem.update({
        where: { id },
        data: { dateEncaissement: date, statut: "VENDU", saleId: sale.id },
      });
    } else if (date && item.saleId) {
      await prisma.sale.update({ where: { id: item.saleId }, data: { dateEncaissement: date } });
      await prisma.stockItem.update({ where: { id }, data: { dateEncaissement: date } });
    } else if (!date && item.saleId) {
      await prisma.sale.update({ where: { id: item.saleId }, data: { deletedAt: new Date() } });
      await prisma.stockItem.update({
        where: { id },
        data: { dateEncaissement: null, saleId: null, statut: item.dateVente ? "EN_ATTENTE" : "EN_STOCK" },
      });
    } else {
      await prisma.stockItem.update({
        where: { id },
        data: { dateEncaissement: null, statut: item.dateVente ? "EN_ATTENTE" : "EN_STOCK" },
      });
    }
  }

  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
  revalidatePath(categoryRoute(item.categoryId));
}

// Encaissement en masse : réutilise la logique d'updateStockDate (cascade de création de
// Sale, transitions de statut) ligne par ligne plutôt que de la dupliquer en un seul
// updateMany, qui ne saurait pas gérer la création automatique de Sale par article.
export async function bulkUpdateStockDates(
  ids: string[],
  path: string,
  dateVente: string | null,
  dateEncaissement: string | null
) {
  for (const id of ids) {
    if (dateVente) await updateStockDate(id, path, "dateVente", dateVente);
    if (dateEncaissement) await updateStockDate(id, path, "dateEncaissement", dateEncaissement);
  }
}

export async function markStockVenduToday(id: string, path: string) {
  await updateStockDate(id, path, "dateVente", new Date().toISOString().slice(0, 10));
}

export async function markStockEncaisseToday(id: string, path: string) {
  await updateStockDate(id, path, "dateEncaissement", new Date().toISOString().slice(0, 10));
}

export async function deleteStockItem(id: string, path: string) {
  await prisma.stockItem.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function restoreStockItem(id: string, path: string) {
  await prisma.stockItem.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function bulkDeleteStockItems(ids: string[], path: string) {
  await prisma.stockItem.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function bulkRestoreStockItems(ids: string[], path: string) {
  await prisma.stockItem.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function duplicateStockItem(id: string, path: string) {
  const item = await prisma.stockItem.findUniqueOrThrow({ where: { id } });
  await prisma.stockItem.create({
    data: {
      categoryId: item.categoryId,
      dateAchat: item.dateAchat,
      description: item.description,
      source: item.source,
      eventId: item.eventId,
      qty: item.qty,
      coutAchatUnit: item.coutAchatUnit,
      prixCibleVente: item.prixCibleVente,
      priorite: item.priorite,
      recu: item.recu,
      tauxTvaAchat: item.tauxTvaAchat,
      compteEmail: item.compteEmail,
      notes: item.notes,
      customValues: item.customValues as object,
    },
  });
  revalidatePath(path);
}
