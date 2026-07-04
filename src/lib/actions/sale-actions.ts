"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { A_ENCAISSER_PATH } from "@/lib/category-routes";

export type SaleCoreField =
  | "dateVente"
  | "dateEncaissement"
  | "source"
  | "statut"
  | "description"
  | "qty"
  | "prixVenteUnit"
  | "coutAchatUnit"
  | "tauxTvaVente"
  | "tauxTvaAchat"
  | "notes";

function toDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createSale(categoryId: string, path: string) {
  const today = new Date();
  const sale = await prisma.sale.create({
    data: {
      categoryId,
      dateVente: today,
      dateEncaissement: today,
      statut: "ENCAISSE",
      qty: 1,
      prixVenteUnit: 0,
      coutAchatUnit: 0,
    },
  });
  revalidatePath(path);
  return sale.id;
}

export async function updateSaleField(
  id: string,
  path: string,
  field: SaleCoreField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "dateVente":
      if (value && !toDate(value)) return; // date invalide reçue du client : on ignore plutôt que d'écraser la vraie date
      data.dateVente = toDate(value) ?? new Date();
      break;
    case "dateEncaissement":
      if (value && !toDate(value)) return;
      data.dateEncaissement = toDate(value);
      break;
    case "qty":
      data.qty = Math.max(1, Number(value) || 1);
      break;
    case "prixVenteUnit":
    case "coutAchatUnit":
    case "tauxTvaVente":
    case "tauxTvaAchat":
      data[field] = Number(value) || 0;
      break;
    case "source":
    case "description":
    case "notes":
      data[field] = value || null;
      break;
    case "statut":
      data.statut = value;
      break;
  }

  await prisma.sale.update({ where: { id }, data });
  revalidatePath(path);
  if (field === "dateEncaissement" || field === "statut") revalidatePath(A_ENCAISSER_PATH);
}

export async function updateSaleCustomValue(
  id: string,
  path: string,
  key: string,
  value: string
) {
  const sale = await prisma.sale.findUniqueOrThrow({ where: { id } });
  const customValues = { ...(sale.customValues as Record<string, string>), [key]: value };
  await prisma.sale.update({ where: { id }, data: { customValues } });
  revalidatePath(path);
}

export async function updateSaleEventId(id: string, path: string, eventId: string | null) {
  await prisma.sale.update({ where: { id }, data: { eventId } });
  revalidatePath(path);
}

export async function deleteSale(id: string, path: string) {
  await prisma.sale.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function restoreSale(id: string, path: string) {
  await prisma.sale.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function bulkDeleteSales(ids: string[], path: string) {
  await prisma.sale.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function bulkRestoreSales(ids: string[], path: string) {
  await prisma.sale.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}

export async function duplicateSale(id: string, path: string) {
  const sale = await prisma.sale.findUniqueOrThrow({ where: { id } });
  await prisma.sale.create({
    data: {
      categoryId: sale.categoryId,
      dateVente: sale.dateVente,
      dateEncaissement: sale.dateEncaissement,
      source: sale.source,
      eventId: sale.eventId,
      statut: sale.statut,
      description: sale.description,
      qty: sale.qty,
      prixVenteUnit: sale.prixVenteUnit,
      coutAchatUnit: sale.coutAchatUnit,
      tauxTvaVente: sale.tauxTvaVente,
      tauxTvaAchat: sale.tauxTvaAchat,
      notes: sale.notes,
      customValues: sale.customValues as object,
    },
  });
  revalidatePath(path);
}

// Encaissement en masse : si une date d'encaissement est fournie, passe aussi le statut à
// ENCAISSE (c'est le sens même de "bulk encaissement" — sinon il faudrait un 2e geste pour
// changer le statut, ce que l'édition ligne par ligne demande déjà).
export async function bulkUpdateSaleDates(
  ids: string[],
  path: string,
  dateVente: string | null,
  dateEncaissement: string | null
) {
  const data: Record<string, unknown> = {};
  if (dateVente) {
    const d = toDate(dateVente);
    if (!d) return;
    data.dateVente = d;
  }
  if (dateEncaissement) {
    const d = toDate(dateEncaissement);
    if (!d) return;
    data.dateEncaissement = d;
    data.statut = "ENCAISSE";
  }
  if (Object.keys(data).length === 0) return;

  await prisma.sale.updateMany({ where: { id: { in: ids } }, data });
  revalidatePath(path);
  if (dateEncaissement) revalidatePath(A_ENCAISSER_PATH);
}

export async function markSaleEncaisseToday(id: string, path: string) {
  await prisma.sale.update({
    where: { id },
    data: { dateEncaissement: new Date(), statut: "ENCAISSE" },
  });
  revalidatePath(path);
  revalidatePath(A_ENCAISSER_PATH);
}
