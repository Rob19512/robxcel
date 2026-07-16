"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fetchUnreadTicketmasterEmails } from "@/lib/gmail/imap-client";
import { parseTicketmasterEmail, type TicketmasterSeat } from "@/lib/gmail/ticketmaster-parser";
import { bulkCreateStockItems, type BulkStockRowInput } from "@/lib/actions/stock-actions";
import { createEventWithDetails } from "@/lib/actions/event-actions";

const BILLETS_CATEGORY_ID = "cat-billets";
const BILLETS_PATH = "/billets";

export type ImportedListingRow = {
  id: string;
  provider: string;
  numeroCommande: string | null;
  eventName: string;
  eventDate: string | null;
  lieuSalle: string | null;
  categorie: string | null;
  qty: number;
  coutAchatUnit: number;
  seats: TicketmasterSeat[];
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
    eventName: r.eventName,
    eventDate: r.eventDate ? r.eventDate.toISOString() : null,
    lieuSalle: r.lieuSalle,
    categorie: r.categorie,
    qty: r.qty,
    coutAchatUnit: Number(r.coutAchatUnit),
    seats: (r.seats as TicketmasterSeat[]) ?? [],
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
        eventName: parsed.eventName,
        eventDate: parsed.eventDate,
        lieuSalle: parsed.lieuSalle,
        categorie: parsed.categorie,
        qty: parsed.qty,
        coutAchatUnit: parsed.coutAchatUnit,
        seats: parsed.seats,
        rawEmailText: email.text,
      },
    });
    created++;
  }

  revalidatePath(BILLETS_PATH);
  return { fetched: emails.length, created, skipped };
}

export type ValidateImportOverrides = {
  eventId: string | null;
  newEventName: string;
  newEventDate: string | null;
  newEventLieuSalle: string | null;
  dateAchat: string;
  coutAchatUnit: number;
  prixCibleVente: number | null;
  compte: string;
};

export async function validateImportedListing(id: string, overrides: ValidateImportOverrides) {
  const listing = await prisma.importedListing.findUniqueOrThrow({ where: { id } });
  if (listing.status !== "PENDING") throw new Error("Ce listing a déjà été traité");

  let eventId: string | null = overrides.eventId;
  if (!eventId && overrides.newEventName.trim()) {
    eventId = await createEventWithDetails(BILLETS_CATEGORY_ID, BILLETS_PATH, {
      name: overrides.newEventName,
      dateEvenement: overrides.newEventDate,
      lieuSalle: overrides.newEventLieuSalle,
      folderId: null,
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

  const rows: BulkStockRowInput[] = (seats.length > 0 ? seats : [null]).map((seat) => ({
    dateAchat: overrides.dateAchat,
    description: "",
    source: "Ticketmaster",
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

  const { count } = await bulkCreateStockItems(BILLETS_CATEGORY_ID, BILLETS_PATH, rows);

  await prisma.importedListing.update({
    where: { id },
    data: { status: "VALIDATED", validatedAt: new Date() },
  });

  revalidatePath(BILLETS_PATH);
  return { count };
}

export async function rejectImportedListing(id: string) {
  await prisma.importedListing.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath(BILLETS_PATH);
}
