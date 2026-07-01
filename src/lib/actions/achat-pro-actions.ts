"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type AchatProField = "dateAchat" | "description" | "categorie" | "qty" | "montantHt" | "tauxTva" | "notes";

function toDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : new Date();
}

export async function createAchatPro(path: string) {
  await prisma.achatPro.create({
    data: {
      dateAchat: new Date(),
      description: "",
      qty: 1,
      montantHt: 0,
    },
  });
  revalidatePath(path);
}

export async function updateAchatProField(
  id: string,
  path: string,
  field: AchatProField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "dateAchat":
      data.dateAchat = toDate(value);
      break;
    case "qty":
      data.qty = Math.max(1, Number(value) || 1);
      break;
    case "montantHt":
    case "tauxTva":
      data[field] = Number(value) || 0;
      break;
    case "categorie":
    case "description":
    case "notes":
      data[field] = value || null;
      break;
  }

  await prisma.achatPro.update({ where: { id }, data });
  revalidatePath(path);
}

export async function deleteAchatPro(id: string, path: string) {
  await prisma.achatPro.delete({ where: { id } });
  revalidatePath(path);
}

export async function duplicateAchatPro(id: string, path: string) {
  const item = await prisma.achatPro.findUniqueOrThrow({ where: { id } });
  await prisma.achatPro.create({
    data: {
      dateAchat: item.dateAchat,
      description: item.description,
      categorie: item.categorie,
      qty: item.qty,
      montantHt: item.montantHt,
      tauxTva: item.tauxTva,
      notes: item.notes,
    },
  });
  revalidatePath(path);
}
