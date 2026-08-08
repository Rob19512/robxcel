"use server";

import { prisma } from "@/lib/prisma";

type BaseRow = {
  Type: string;
  Catégorie: string;
  Événement: string;
  Description: string;
  "Date achat": string;
  "Date vente": string;
  "Date encaissement": string;
  Statut: string;
  Priorité: string;
  Reçu: string;
  Quantité: string;
  "Coût achat unitaire (TTC)": string;
  "TVA achat (%)": string;
  "Prix vente unitaire (TTC)": string;
  "TVA vente (%)": string;
  "Site / Source": string;
  "Email compte (intégré)": string;
  "Montant HT": string;
  "TVA (%)": string;
  Montant: string;
  Notes: string;
  "Créé le": string;
};

export type ExportRow = BaseRow & Record<string, string>;

function baseEmptyRow(): BaseRow {
  return {
    Type: "",
    Catégorie: "",
    Événement: "",
    Description: "",
    "Date achat": "",
    "Date vente": "",
    "Date encaissement": "",
    Statut: "",
    Priorité: "",
    Reçu: "",
    Quantité: "",
    "Coût achat unitaire (TTC)": "",
    "TVA achat (%)": "",
    "Prix vente unitaire (TTC)": "",
    "TVA vente (%)": "",
    "Site / Source": "",
    "Email compte (intégré)": "",
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

  const [stockItems, sales, events, achatsPro, chargesPerso, categoryFields] = await Promise.all([
    prisma.stockItem.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.sale.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.event.findMany({ where: { categoryId: { in: categoryIds } } }),
    scope === "PRO" ? prisma.achatPro.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
    scope === "PERSO" ? prisma.chargePerso.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
    prisma.categoryField.findMany({ where: { categoryId: { in: categoryIds } } }),
  ]);

  // Chaque catégorie (Billets, Merch...) définit ses propres champs personnalisés
  // (Catégorie/Placement, Listing site, Infos vente...), stockés dans customValues (JSON) -
  // un export figé sur 2-3 clés en dur en oubliait la moitié. On construit ici la liste
  // complète des colonnes dynamiques (dédupliquées par clé) à partir de ce qui existe
  // réellement pour ce périmètre, pour que chaque ligne ait toujours le même jeu de
  // colonnes (obligatoire pour que le writer CSV ne tronque rien).
  const customFieldEntries: [string, string][] = [];
  const seenKeys = new Set<string>();
  for (const f of categoryFields) {
    if (seenKeys.has(f.key)) continue;
    seenKeys.add(f.key);
    customFieldEntries.push([f.key, f.label]);
  }

  function emptyRow(): ExportRow {
    const row = baseEmptyRow() as ExportRow;
    for (const [, label] of customFieldEntries) row[label] = "";
    return row;
  }

  function applyCustomValues(row: ExportRow, customValues: unknown) {
    const cv = (customValues as Record<string, string>) ?? {};
    for (const [key, label] of customFieldEntries) {
      if (cv[key] !== undefined && cv[key] !== null && cv[key] !== "") row[label] = String(cv[key]);
    }
  }

  const eventById = new Map(events.map((e) => [e.id, e]));
  const eventLabel = (eventId: string | null) => {
    if (!eventId) return "";
    const e = eventById.get(eventId);
    if (!e) return "";
    return [e.name, d(e.dateEvenement), e.lieuSalle].filter(Boolean).join(" — ");
  };

  const rows: ExportRow[] = [];

  for (const it of stockItems) {
    const row = emptyRow();
    Object.assign(row, {
      Type: "Stock",
      Catégorie: categoryNameById.get(it.categoryId) ?? "",
      Événement: eventLabel(it.eventId),
      Description: it.description ?? "",
      "Date achat": d(it.dateAchat),
      "Date vente": d(it.dateVente),
      "Date encaissement": d(it.dateEncaissement),
      Statut: it.statut,
      Priorité: it.priorite ?? "",
      Reçu: it.recu === null ? "" : it.recu ? "Oui" : "Non",
      Quantité: String(it.qty),
      "Coût achat unitaire (TTC)": String(it.coutAchatUnit),
      "TVA achat (%)": String(it.tauxTvaAchat),
      "Prix vente unitaire (TTC)": it.prixCibleVente !== null ? String(it.prixCibleVente) : "",
      "TVA vente (%)": String(it.tauxTvaVente),
      "Site / Source": it.source ?? "",
      "Email compte (intégré)": it.compteEmail ?? "",
      Notes: it.notes ?? "",
      "Créé le": d(it.createdAt),
    });
    applyCustomValues(row, it.customValues);
    rows.push(row);
  }

  for (const s of sales) {
    const row = emptyRow();
    Object.assign(row, {
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
      Notes: s.notes ?? "",
      "Créé le": d(s.createdAt),
    });
    applyCustomValues(row, s.customValues);
    rows.push(row);
  }

  for (const e of events) {
    const row = emptyRow();
    Object.assign(row, {
      Type: "Événement",
      Catégorie: categoryNameById.get(e.categoryId) ?? "",
      Événement: e.name,
      "Date achat": d(e.dateEvenement),
      Notes: [e.lieuSalle, e.notes].filter(Boolean).join(" — "),
      "Créé le": d(e.createdAt),
    });
    rows.push(row);
  }

  for (const a of achatsPro) {
    const row = emptyRow();
    Object.assign(row, {
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
    rows.push(row);
  }

  for (const c of chargesPerso) {
    const row = emptyRow();
    Object.assign(row, {
      Type: "Charge perso",
      Catégorie: c.categorie ?? "",
      Description: c.description,
      "Date achat": d(c.date),
      Quantité: String(c.qty),
      Montant: String(c.montant),
      Notes: c.notes ?? "",
      "Créé le": d(c.createdAt),
    });
    rows.push(row);
  }

  rows.sort((a, b) => {
    const da = a["Date achat"] || a["Date vente"] || "";
    const db = b["Date achat"] || b["Date vente"] || "";
    return da.localeCompare(db);
  });

  return rows;
}
