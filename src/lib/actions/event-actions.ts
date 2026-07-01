"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type EventField = "name" | "dateEvenement" | "lieuSalle" | "notes";

function toDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function createEvent(categoryId: string, path: string) {
  await prisma.event.create({
    data: { categoryId, name: "Nouvel événement" },
  });
  revalidatePath(path);
}

export async function updateEventField(
  id: string,
  path: string,
  field: EventField,
  value: string | null
) {
  const data: Record<string, unknown> = {};

  switch (field) {
    case "dateEvenement":
      data.dateEvenement = toDate(value);
      break;
    case "name":
      data.name = value || "Nouvel événement";
      break;
    case "lieuSalle":
    case "notes":
      data[field] = value || null;
      break;
  }

  await prisma.event.update({ where: { id }, data });
  revalidatePath(path);
}

export async function deleteEvent(id: string, path: string) {
  await prisma.event.delete({ where: { id } });
  revalidatePath(path);
}
