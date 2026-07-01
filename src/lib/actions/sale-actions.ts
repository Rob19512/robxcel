"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function createSale(categoryId: string, path: string) {
  const today = new Date();
  await prisma.sale.create({
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
      data.dateVente = toDate(value) ?? new Date();
      break;
    case "dateEncaissement":
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
  await prisma.sale.delete({ where: { id } });
  revalidatePath(path);
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

export async function markSaleEncaisseToday(id: string, path: string) {
  await prisma.sale.update({
    where: { id },
    data: { dateEncaissement: new Date(), statut: "ENCAISSE" },
  });
  revalidatePath(path);
}
