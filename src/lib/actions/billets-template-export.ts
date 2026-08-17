"use server";

import { prisma } from "@/lib/prisma";

const BILLETS_CATEGORY_ID = "cat-billets";

export type TemplateRow = {
  title: string;
  platform: string;
  event_date: string;
  purchase_date: string;
  location: string;
  purchase_price: string;
  tax_per_ticket: string;
  purchase_vat_rate: string;
  sale_vat_rate: string;
  notes: string;
  quantity: string;
  sold_quantity: string;
  category: string;
  purchase_type: string;
  account_email: string;
  account_password: string;
  sale_price: string;
  sale_date: string;
  sale_status: string;
  payout_date: string;
  buyer_email: string;
  client_name: string;
  listing_platform: string;
  sale_platform: string;
  sale_number: string;
  section: string;
  row: string;
  seats: string;
  ticket_type: string;
  order_number: string;
  currency: string;
};

function d(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function num(value: unknown): string {
  return value === null || value === undefined ? "" : String(Number(value));
}

// "Catégorie / Placement" est stocké chez nous comme une seule chaîne combinée
// ("Tier - Section, Rang R, Place P") - on la re-décompose ici en best-effort pour
// remplir category/section/row séparément comme le veut le template. Quand seul le tier
// est connu (cas fréquent, ex. "Catégorie D" sans détail de placement), section/row
// restent vides plutôt que d'inventer une valeur.
function splitCategoriePlacement(value: string) {
  const m = value.match(/^(.*?),\s*Rang\s+(.+?),\s*Place\s+(.+)$/i);
  const mRang = !m ? value.match(/^(.*?),\s*Rang\s+(.+)$/i) : null;
  const mPlace = !m && !mRang ? value.match(/^(.*?),\s*Place\s+(.+)$/i) : null;

  let categorie = value.trim();
  let rang = "";
  let place = "";
  if (m) {
    categorie = m[1].trim();
    rang = m[2].trim();
    place = m[3].trim();
  } else if (mRang) {
    categorie = mRang[1].trim();
    rang = mRang[2].trim();
  } else if (mPlace) {
    categorie = mPlace[1].trim();
    place = mPlace[2].trim();
  }

  // Le tier et la section sont accolés avec " - " (voir claude-import-actions.ts /
  // ticketmaster-parser.ts) - on les sépare quand c'est présent.
  const dashIdx = categorie.lastIndexOf(" - ");
  const category = dashIdx >= 0 ? categorie.slice(0, dashIdx).trim() : categorie;
  const section = dashIdx >= 0 ? categorie.slice(dashIdx + 3).trim() : "";

  // Sur certains listings, une plage de sièges ("45-48") a été saisie dans le champ Rang
  // au lieu de Place - une rangée n'est quasiment jamais une plage numérique, donc on la
  // traite comme des sièges plutôt que comme un vrai numéro de rangée.
  if (/^\d+\s*-\s*\d+$/.test(rang) && !place) {
    place = rang;
    rang = "";
  }

  return { category, section, rang, place };
}

// account_email/account_password sont stockés fusionnés dans customValues.compte, sous
// deux formats possibles : "email / motdepasse" (import Claude, voir claude-import-
// actions.ts) ou "email:motdepasse" (listes collées telles quelles). Pour le 2e format,
// l'utilisateur préfère garder le mot de passe visible dans Notes plutôt que dans la
// colonne dédiée du template.
function splitCompte(value: string): { email: string; password: string; extraNote: string } {
  const slashIdx = value.indexOf(" / ");
  if (slashIdx !== -1) {
    return { email: value.slice(0, slashIdx).trim(), password: value.slice(slashIdx + 3).trim(), extraNote: "" };
  }
  const colonIdx = value.indexOf(":");
  if (colonIdx !== -1) {
    const after = value.slice(colonIdx + 1).trim();
    return { email: value.slice(0, colonIdx).trim(), password: "", extraNote: after };
  }
  return { email: value.trim(), password: "", extraNote: "" };
}

export async function exportBilletsTemplate(): Promise<TemplateRow[]> {
  const [items, events] = await Promise.all([
    prisma.stockItem.findMany({
      where: { categoryId: BILLETS_CATEGORY_ID, deletedAt: null },
      include: { sale: true },
      orderBy: { dateAchat: "asc" },
    }),
    prisma.event.findMany({ where: { categoryId: BILLETS_CATEGORY_ID } }),
  ]);
  const eventById = new Map(events.map((e) => [e.id, e]));

  type Group = {
    items: typeof items;
  };
  const groups = new Map<string, Group>();
  for (const it of items) {
    const key = `${it.eventId ?? "none"}|${(it.customValues as Record<string, string>)?.numeroCommande ?? ""}|${it.coutAchatUnit}`;
    const g = groups.get(key);
    if (g) g.items.push(it);
    else groups.set(key, { items: [it] });
  }

  const rows: TemplateRow[] = [];

  for (const { items: groupItems } of groups.values()) {
    const first = groupItems[0];
    const cv = (first.customValues as Record<string, string>) ?? {};
    const event = first.eventId ? eventById.get(first.eventId) : null;
    const placement = splitCategoriePlacement(cv.categoriePlacement ?? "");
    const { email, password, extraNote } = splitCompte(cv.compte ?? "");
    const notes = [first.notes, extraNote].filter(Boolean).join(" — ");

    const seats = groupItems
      .map((it) => splitCategoriePlacement((it.customValues as Record<string, string>)?.categoriePlacement ?? "").place)
      .filter(Boolean);

    const soldItems = groupItems.filter((it) => it.statut === "VENDU" && it.sale);
    const pendingItems = groupItems.filter((it) => it.statut === "EN_ATTENTE");
    const firstSold = soldItems[0]?.sale ?? null;
    const firstPending = pendingItems[0] ?? null;
    // received = tout le lot est vendu ET encaissé ; pending = au moins un billet vendu
    // mais pas (encore) encaissé pour tout le lot ; listing = rien de vendu du tout.
    const saleStatus =
      soldItems.length === groupItems.length ? "received" : pendingItems.length > 0 ? "pending" : "listing";

    rows.push({
      title: event?.name ?? first.description ?? "",
      platform: first.source ?? "",
      event_date: d(event?.dateEvenement),
      purchase_date: d(first.dateAchat),
      location: event?.lieuSalle ?? "",
      purchase_price: num(first.coutAchatUnit),
      tax_per_ticket: "",
      purchase_vat_rate: num(first.tauxTvaAchat),
      sale_vat_rate: num(first.tauxTvaVente),
      notes,
      quantity: String(groupItems.length),
      sold_quantity: String(soldItems.length),
      category: placement.category,
      purchase_type: "Société",
      account_email: email,
      account_password: password,
      sale_price: firstSold
        ? num(firstSold.prixVenteUnit)
        : firstPending
          ? num(firstPending.prixCibleVente)
          : first.prixCibleVente !== null
            ? num(first.prixCibleVente)
            : "",
      sale_date: firstSold ? d(firstSold.dateVente) : firstPending ? d(firstPending.dateVente) : "",
      sale_status: saleStatus,
      payout_date: firstSold ? d(firstSold.dateEncaissement) : "",
      buyer_email: "",
      client_name: "",
      listing_platform: "",
      sale_platform: firstSold?.source ?? "",
      sale_number: "",
      section: placement.section,
      row: placement.rang,
      seats: seats.join(", "),
      ticket_type: "",
      order_number: cv.numeroCommande ?? "",
      currency: "EUR",
    });
  }

  rows.sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  return rows;
}
