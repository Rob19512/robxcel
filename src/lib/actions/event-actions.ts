"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type EventField = "name" | "dateEvenement" | "lieuSalle" | "notes";

function toDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createEvent(categoryId: string, path: string) {
  await prisma.event.create({
    data: { categoryId, name: "Nouvel événement" },
  });
  revalidatePath(path);
}

export async function createEventWithDetails(
  categoryId: string,
  path: string,
  data: { name: string; dateEvenement: string | null; lieuSalle: string | null; folderId: string | null }
) {
  const event = await prisma.event.create({
    data: {
      categoryId,
      name: data.name.trim() || "Nouvel événement",
      dateEvenement: toDate(data.dateEvenement),
      lieuSalle: data.lieuSalle?.trim() || null,
      folderId: data.folderId,
    },
  });
  revalidatePath(path);
  return event.id;
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

export async function bulkDeleteEvents(ids: string[], path: string) {
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
  revalidatePath(path);
}

export async function updateEventFolder(id: string, path: string, folderId: string | null) {
  await prisma.event.update({ where: { id }, data: { folderId } });
  revalidatePath(path);
}

export async function createEventFolder(categoryId: string, path: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du dossier est requis");
  try {
    const folder = await prisma.eventFolder.create({ data: { categoryId, name: trimmed } });
    revalidatePath(path);
    return folder.id;
  } catch {
    throw new Error("Un dossier avec ce nom existe déjà");
  }
}

export async function renameEventFolder(id: string, path: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du dossier est requis");
  try {
    await prisma.eventFolder.update({ where: { id }, data: { name: trimmed } });
    revalidatePath(path);
  } catch {
    throw new Error("Un dossier avec ce nom existe déjà");
  }
}

export async function deleteEventFolder(id: string, path: string) {
  // Les événements du dossier ne sont pas supprimés, juste dé-liés (folderId -> null).
  await prisma.eventFolder.delete({ where: { id } });
  revalidatePath(path);
}
