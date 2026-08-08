"use server";

import { prisma } from "@/lib/prisma";

export type ExportRow = {
  Type: string;
  Catégorie: string;
  Événement: string;
  Description: string;
  "Date achat": string;
  "Date vente": string;
  "Date encaissement": string;
  Statut: string;
  Quantité: string;
  "Coût achat unitaire (TTC)": string;
  "TVA achat (%)": string;
  "Prix vente unitaire (TTC)": string;
  "TVA vente (%)": string;
  "Site / Source": string;
  Compte: string;
  "Numéro de commande": string;
  "Montant HT": string;
  "TVA (%)": string;
  Montant: string;
  Notes: string;
  "Créé le": string;
};

function emptyRow(): ExportRow {
  return {
    Type: "",
    Catégorie: "",
    Événement: "",
    Description: "",
    "Date achat": "",
    "Date vente": "",
    "Date encaissement": "",
    Statut: "",
    Quantité: "",
    "Coût achat unitaire (TTC)": "",
    "TVA achat (%)": "",
    "Prix vente unitaire (TTC)": "",
    "TVA vente (%)": "",
    "Site / Source": "",
    Compte: "",
    "Numéro de commande": "",
    "Montant HT": "",
    "TVA (%)": "",
    Montant: "",
    Notes: "",
    "Créé le": "",
  };
}

function d(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function exportScopeData(scope: "PRO" | "PERSO"): Promise<ExportRow[]> {
  const categories = await prisma.category.findMany({ where: { scope } });
  const categoryIds = categories.map((c) => c.id);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const [stockItems, sales, events, achatsPro, chargesPerso] = await Promise.all([
    prisma.stockItem.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.sale.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.event.findMany({ where: { categoryId: { in: categoryIds } } }),
    scope === "PRO" ? prisma.achatPro.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
    scope === "PERSO" ? prisma.chargePerso.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
  ]);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const eventLabel = (eventId: string | null) => {
    if (!eventId) return "";
    const e = eventById.get(eventId);
    if (!e) return "";
    return [e.name, d(e.dateEvenement), e.lieuSalle].filter(Boolean).join(" — ");
  };

  const rows: ExportRow[] = [];

  for (const it of stockItems) {
    const cv = (it.customValues as Record<string, string>) ?? {};
    rows.push({
      ...emptyRow(),
      Type: "Stock",
      Catégorie: categoryNameById.get(it.categoryId) ?? "",
      Événement: eventLabel(it.eventId),
      Description: it.description ?? "",
      "Date achat": d(it.dateAchat),
      "Date vente": d(it.dateVente),
      "Date encaissement": d(it.dateEncaissement),
      Statut: it.statut,
      Quantité: String(it.qty),
      "Coût achat unitaire (TTC)": String(it.coutAchatUnit),
      "TVA achat (%)": String(it.tauxTvaAchat),
      "Prix vente unitaire (TTC)": it.prixCibleVente !== null ? String(it.prixCibleVente) : "",
      "TVA vente (%)": String(it.tauxTvaVente),
      "Site / Source": it.source ?? "",
      Compte: cv.compte ?? it.compteEmail ?? "",
      "Numéro de commande": cv.numeroCommande ?? "",
      Notes: it.notes ?? "",
      "Créé le": d(it.createdAt),
    });
  }

  for (const s of sales) {
    const cv = (s.customValues as Record<string, string>) ?? {};
    rows.push({
      ...emptyRow(),
      Type: "Vente",
      Catégorie: categoryNameById.get(s.categoryId) ?? "",
      Événement: eventLabel(s.eventId),
      Description: s.description ?? "",
      "Date vente": d(s.dateVente),
      "Date encaissement": d(s.dateEncaissement),
      Statut: s.statut,
      Quantité: String(s.qty),
      "Coût achat unitaire (TTC)": String(s.coutAchatUnit),
      "TVA achat (%)": String(s.tauxTvaAchat),
      "Prix vente unitaire (TTC)": String(s.prixVenteUnit),
      "TVA vente (%)": String(s.tauxTvaVente),
      "Site / Source": s.source ?? "",
      Compte: cv.compte ?? "",
      "Numéro de commande": cv.numeroCommande ?? "",
      Notes: s.notes ?? "",
      "Créé le": d(s.createdAt),
    });
  }

  for (const e of events) {
    rows.push({
      ...emptyRow(),
      Type: "Événement",
      Catégorie: categoryNameById.get(e.categoryId) ?? "",
      Événement: e.name,
      "Date achat": d(e.dateEvenement),
      Notes: [e.lieuSalle, e.notes].filter(Boolean).join(" — "),
      "Créé le": d(e.createdAt),
    });
  }

  for (const a of achatsPro) {
    rows.push({
      ...emptyRow(),
      Type: "Achat pro",
      Catégorie: a.categorie ?? "",
      Description: a.description,
      "Date achat": d(a.dateAchat),
      Quantité: String(a.qty),
      "Montant HT": String(a.montantHt),
      "TVA (%)": String(a.tauxTva),
      Notes: a.notes ?? "",
      "Créé le": d(a.createdAt),
    });
  }

  for (const c of chargesPerso) {
    rows.push({
      ...emptyRow(),
      Type: "Charge perso",
      Catégorie: c.categorie ?? "",
      Description: c.description,
      "Date achat": d(c.date),
      Quantité: String(c.qty),
      Montant: String(c.montant),
      Notes: c.notes ?? "",
      "Créé le": d(c.createdAt),
    });
  }

  rows.sort((a, b) => {
    const da = a["Date achat"] || a["Date vente"] || "";
    const db = b["Date achat"] || b["Date vente"] || "";
    return da.localeCompare(db);
  });

  return rows;
}
