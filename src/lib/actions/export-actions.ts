"use server";

import { prisma } from "@/lib/prisma";

type BaseRow = {
  Type: string;
  Catégorie: string;
  Événement: string;
  Dossier: string;
  "Lieu / Salle": string;
  "Date événement": string;
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
  "Modifié le": string;
};

export type ExportRow = BaseRow & Record<string, string>;

function baseEmptyRow(): BaseRow {
  return {
    Type: "",
    Catégorie: "",
    Événement: "",
    Dossier: "",
    "Lieu / Salle": "",
    "Date événement": "",
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
    "Modifié le": "",
  };
}

function d(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// Les champs Decimal de Prisma ne se convertissent pas forcément proprement en texte via un
// simple String() direct - passer par Number() d'abord est la convention déjà utilisée partout
// ailleurs dans le projet (serialize.ts, tva-quarterly.tsx...), on l'applique ici aussi.
function n(value: unknown): string {
  return value === null || value === undefined ? "" : String(Number(value));
}

export async function exportScopeData(scope: "PRO" | "PERSO"): Promise<ExportRow[]> {
  const categories = await prisma.category.findMany({ where: { scope } });
  const categoryIds = categories.map((c) => c.id);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const [stockItems, sales, events, achatsPro, chargesPerso, categoryFields, eventFolders] = await Promise.all([
    prisma.stockItem.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.sale.findMany({ where: { categoryId: { in: categoryIds }, deletedAt: null } }),
    prisma.event.findMany({ where: { categoryId: { in: categoryIds } } }),
    scope === "PRO" ? prisma.achatPro.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
    scope === "PERSO" ? prisma.chargePerso.findMany({ where: { deletedAt: null } }) : Promise.resolve([]),
    prisma.categoryField.findMany({ where: { categoryId: { in: categoryIds } } }),
    prisma.eventFolder.findMany({ where: { categoryId: { in: categoryIds } } }),
  ]);
  const folderNameById = new Map(eventFolders.map((f) => [f.id, f.name]));

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
  const folderLabel = (eventId: string | null) => {
    if (!eventId) return "";
    const e = eventById.get(eventId);
    if (!e?.folderId) return "";
    return folderNameById.get(e.folderId) ?? "";
  };
  const eventDateOf = (eventId: string | null) => {
    if (!eventId) return "";
    const e = eventById.get(eventId);
    return e ? d(e.dateEvenement) : "";
  };

  const rows: ExportRow[] = [];

  for (const it of stockItems) {
    const row = emptyRow();
    Object.assign(row, {
      Type: "Stock",
      Catégorie: categoryNameById.get(it.categoryId) ?? "",
      Événement: eventLabel(it.eventId),
      Dossier: folderLabel(it.eventId),
      "Date événement": eventDateOf(it.eventId),
      Description: it.description ?? "",
      "Date achat": d(it.dateAchat),
      "Date vente": d(it.dateVente),
      "Date encaissement": d(it.dateEncaissement),
      Statut: it.statut,
      Priorité: it.priorite ?? "",
      Reçu: it.recu === null ? "" : it.recu ? "Oui" : "Non",
      Quantité: String(it.qty),
      "Coût achat unitaire (TTC)": n(it.coutAchatUnit),
      "TVA achat (%)": n(it.tauxTvaAchat),
      "Prix vente unitaire (TTC)": n(it.prixCibleVente),
      "TVA vente (%)": n(it.tauxTvaVente),
      "Site / Source": it.source ?? "",
      "Email compte (intégré)": it.compteEmail ?? "",
      Notes: it.notes ?? "",
      "Créé le": d(it.createdAt),
      "Modifié le": d(it.updatedAt),
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
      Dossier: folderLabel(s.eventId),
      "Date événement": eventDateOf(s.eventId),
      Description: s.description ?? "",
      "Date vente": d(s.dateVente),
      "Date encaissement": d(s.dateEncaissement),
      Statut: s.statut,
      Quantité: String(s.qty),
      "Coût achat unitaire (TTC)": n(s.coutAchatUnit),
      "TVA achat (%)": n(s.tauxTvaAchat),
      "Prix vente unitaire (TTC)": n(s.prixVenteUnit),
      "TVA vente (%)": n(s.tauxTvaVente),
      "Site / Source": s.source ?? "",
      Notes: s.notes ?? "",
      "Créé le": d(s.createdAt),
      "Modifié le": d(s.updatedAt),
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
      Dossier: e.folderId ? folderNameById.get(e.folderId) ?? "" : "",
      "Lieu / Salle": e.lieuSalle ?? "",
      "Date événement": d(e.dateEvenement),
      Notes: e.notes ?? "",
      "Créé le": d(e.createdAt),
      "Modifié le": d(e.updatedAt),
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
      "Montant HT": n(a.montantHt),
      "TVA (%)": n(a.tauxTva),
      Notes: a.notes ?? "",
      "Créé le": d(a.createdAt),
      "Modifié le": d(a.updatedAt),
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
      Montant: n(c.montant),
      Notes: c.notes ?? "",
      "Créé le": d(c.createdAt),
      "Modifié le": d(c.updatedAt),
    });
    rows.push(row);
  }

  // Regroupé par événement plutôt que trié uniquement par date : sinon les lignes Événement
  // (dates futures de concerts) et les lignes Stock/Vente (dates d'achat passées/récentes) se
  // mélangent dans un ordre chronologique global qui les éloigne les unes des autres, rendant
  // difficile de vérifier que les billets d'un même événement ont bien leurs prix.
  const typeOrder: Record<string, number> = { Événement: 0, Stock: 1, Vente: 2, "Achat pro": 3, "Charge perso": 3 };
  rows.sort((a, b) => {
    const evA = a["Événement"];
    const evB = b["Événement"];
    if (evA !== evB) return evA.localeCompare(evB);
    const ta = typeOrder[a.Type] ?? 9;
    const tb = typeOrder[b.Type] ?? 9;
    if (ta !== tb) return ta - tb;
    const da = a["Date achat"] || a["Date vente"] || "";
    const db = b["Date achat"] || b["Date vente"] || "";
    return da.localeCompare(db);
  });

  return rows;
}
