"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ChargePersoField = "date" | "description" | "categorie" | "qty" | "montant" | "notes";

function toDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createChargePerso(path: string) {
  await prisma.chargePerso.create({
    data: {
      date: new Date(),
      description: "",
      qty: 1,
      montant: 0,
    },
  });
  revalidatePath(path);
}

export async function updateChargePersoField(
  id: string,
  path: string,
  field: ChargePersoField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "date":
      if (value && !toDate(value)) return; // date invalide reçue du client : on ignore plutôt que d'écraser la vraie date
      data.date = toDate(value) ?? new Date();
      break;
    case "qty":
      data.qty = Math.max(1, Number(value) || 1);
      break;
    case "montant":
      data.montant = Number(value) || 0;
      break;
    case "categorie":
    case "description":
    case "notes":
      data[field] = value || null;
      break;
  }

  await prisma.chargePerso.update({ where: { id }, data });
  revalidatePath(path);
}

export async function deleteChargePerso(id: string, path: string) {
  await prisma.chargePerso.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath(path);
}

export async function restoreChargePerso(id: string, path: string) {
  await prisma.chargePerso.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath(path);
}

export async function bulkDeleteChargesPerso(ids: string[], path: string) {
  await prisma.chargePerso.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  revalidatePath(path);
}

export async function bulkRestoreChargesPerso(ids: string[], path: string) {
  await prisma.chargePerso.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  revalidatePath(path);
}

export async function duplicateChargePerso(id: string, path: string) {
  const item = await prisma.chargePerso.findUniqueOrThrow({ where: { id } });
  await prisma.chargePerso.create({
    data: {
      date: item.date,
      description: item.description,
      categorie: item.categorie,
      qty: item.qty,
      montant: item.montant,
      notes: item.notes,
    },
  });
  revalidatePath(path);
}
