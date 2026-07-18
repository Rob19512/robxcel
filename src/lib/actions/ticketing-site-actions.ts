"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listTicketingSites() {
  const sites = await prisma.ticketingSite.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    tauxTvaAchat: s.tauxTvaAchat !== null ? Number(s.tauxTvaAchat) : null,
  }));
}

export async function createTicketingSite(name: string, tauxTvaAchat: number | null) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom de site requis");
  const count = await prisma.ticketingSite.count();
  await prisma.ticketingSite.create({
    data: { name: trimmed, tauxTvaAchat, sortOrder: count },
  });
  revalidatePath("/tva");
  revalidatePath("/billets");
  revalidatePath("/perso/billets");
}

export async function updateTicketingSiteRate(id: string, tauxTvaAchat: number | null) {
  await prisma.ticketingSite.update({ where: { id }, data: { tauxTvaAchat } });
  revalidatePath("/tva");
}

export async function deleteTicketingSite(id: string) {
  await prisma.ticketingSite.delete({ where: { id } });
  revalidatePath("/tva");
  revalidatePath("/billets");
  revalidatePath("/perso/billets");
}
