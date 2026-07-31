"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fetchUnreadTicketmasterEmails } from "@/lib/gmail/imap-client";
import { parseTicketmasterEmail, type TicketmasterSeat } from "@/lib/gmail/ticketmaster-parser";
import { bulkCreateStockItems, type BulkStockRowInput } from "@/lib/actions/stock-actions";
import { createEventWithDetails } from "@/lib/actions/event-actions";

// La file d'attente est partagée entre Billets Pro et Perso (même Gmail, mêmes textes
// collés) - ces deux pages doivent voir leurs listes se rafraîchir quel que soit l'onglet
// depuis lequel une action a été déclenchée.
const IMPORT_PAGES = ["/billets", "/perso/billets"];

function revalidateImportPages() {
  for (const p of IMPORT_PAGES) revalidatePath(p);
}

export type ImportedListingRow = {
  id: string;
  provider: string;
  numeroCommande: string | null;
  recipientEmail: string | null;
  orderDate: string | null;
  eventName: string;
  eventDate: string | null;
  lieuSalle: string | null;
  categorie: string | null;
  qty: number;
  coutAchatUnit: number;
  seats: TicketmasterSeat[];
  source: string | null;
  folderName: string | null;
  createdAt: string;
};

export async function listPendingImports(): Promise<ImportedListingRow[]> {
  const rows = await prisma.importedListing.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    numeroCommande: r.numeroCommande,
    recipientEmail: r.recipientEmail,
    orderDate: r.orderDate ? r.orderDate.toISOString() : null,
    eventName: r.eventName,
    eventDate: r.eventDate ? r.eventDate.toISOString() : null,
    lieuSalle: r.lieuSalle,
    categorie: r.categorie,
    qty: r.qty,
    coutAchatUnit: Number(r.coutAchatUnit),
    seats: (r.seats as TicketmasterSeat[]) ?? [],
    source: r.source,
    folderName: r.folderName,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function syncTicketmasterImports() {
  const emails = await fetchUnreadTicketmasterEmails();
  let created = 0;
  let skipped = 0;

  for (const email of emails) {
    const existing = await prisma.importedListing.findUnique({
      where: { gmailMessageId: email.gmailMessageId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const parsed = parseTicketmasterEmail(email.subject, email.text);
    if (!parsed) {
      skipped++;
      continue;
    }

    await prisma.importedListing.create({
      data: {
        provider: "TICKETMASTER",
        gmailMessageId: email.gmailMessageId,
        numeroCommande: parsed.numeroCommande,
        recipientEmail: email.recipientEmail,
        orderDate: email.orderDate,
        eventName: parsed.eventName,
        eventDate: parsed.eventDate,
        lieuSalle: parsed.lieuSalle,
        categorie: parsed.categorie,
        qty: parsed.qty,
        coutAchatUnit: parsed.coutAchatUnit,
        seats: parsed.seats,
        rawEmailText: email.text,
        source: "Ticketmaster",
      },
    });
    created++;
  }

  revalidateImportPages();
  return { fetched: emails.length, created, skipped };
}

export type ValidateImportOverrides = {
  eventId: string | null;
  newEventName: string;
  newEventDate: string | null;
  newEventLieuSalle: string | null;
  newEventFolderName: string | null;
  dateAchat: string;
  coutAchatUnit: number;
  prixCibleVente: number | null;
  compte: string;
  source: string;
};

async function resolveFolderId(categoryId: string, name: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const existing = await prisma.eventFolder.findFirst({
    where: { categoryId, name: trimmed },
  });
  if (existing) return existing.id;
  const created = await prisma.eventFolder.create({
    data: { categoryId, name: trimmed },
  });
  return created.id;
}

export async function validateImportedListing(
  id: string,
  categoryId: string,
  path: string,
  overrides: ValidateImportOverrides
) {
  const listing = await prisma.importedListing.findUniqueOrThrow({ where: { id } });
  if (listing.status !== "PENDING") throw new Error("Ce listing a déjà été traité");

  let eventId: string | null = overrides.eventId;
  if (!eventId && overrides.newEventName.trim()) {
    eventId = await createEventWithDetails(categoryId, path, {
      name: overrides.newEventName,
      dateEvenement: overrides.newEventDate,
      lieuSalle: overrides.newEventLieuSalle,
      folderId: await resolveFolderId(categoryId, overrides.newEventFolderName),
    });
  }

  const seats = (listing.seats as TicketmasterSeat[]) ?? [];
  const placementFor = (seat: TicketmasterSeat | null) => {
    const bits = [listing.categorie, seat?.section].filter(Boolean) as string[];
    const parts = [bits.join(" - ")];
    if (seat?.rang) parts.push(`Rang ${seat.rang}`);
    if (seat?.place) parts.push(`Place ${seat.place}`);
    return parts.filter(Boolean).join(", ");
  };

  const source = overrides.source.trim() || listing.source || "Ticketmaster";

  const rows: BulkStockRowInput[] = (seats.length > 0 ? seats : [null]).map((seat) => ({
    dateAchat: overrides.dateAchat,
    description: "",
    source,
    eventId,
    qty: 1,
    coutAchatUnit: overrides.coutAchatUnit,
    prixCibleVente: overrides.prixCibleVente,
    priorite: null,
    recu: null,
    compteEmail: "",
    notes: "",
    customValues: {
      categoriePlacement: placementFor(seat),
      numeroCommande: listing.numeroCommande ?? "",
      compte: overrides.compte,
      listingSite: "",
    },
  }));

  const { count } = await bulkCreateStockItems(categoryId, path, rows);

  await prisma.importedListing.update({
    where: { id },
    data: { status: "VALIDATED", validatedAt: new Date() },
  });

  revalidateImportPages();
  return { count };
}

export async function rejectImportedListing(id: string) {
  await prisma.importedListing.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidateImportPages();
}
