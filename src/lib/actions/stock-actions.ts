"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ROUTES, A_ENCAISSER_PATH } from "@/lib/category-routes";

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
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
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

export async function updateStockField(
  id: string,
  path: string,
  field: StockCoreField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "dateAchat":
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
  const saleRoute = CATEGORY_ROUTES[item.categoryId];
  if (saleRoute) revalidatePath(saleRoute);
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
