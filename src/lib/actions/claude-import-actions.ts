"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TicketmasterSeat } from "@/lib/gmail/ticketmaster-parser";

// File d'attente partagée entre Billets Pro et Perso - les deux pages doivent voir la
// liste se rafraîchir, quel que soit l'onglet depuis lequel le texte a été collé.
const IMPORT_PAGES = ["/billets", "/perso/billets"];
const CLAUDE_MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Tu extrais des listings de billets à partir d'un texte collé par l'utilisateur (confirmations de commande, listes de billets, etc.).
Réponds UNIQUEMENT avec un tableau JSON (pas de texte autour, pas de balises markdown), où chaque élément représente UNE ligne d'événement (un groupe de billets identiques pour un même événement, dans une même commande) avec ce format exact :
[
  {
    "numeroCommande": string | null,
    "compte": string | null,
    "motDePasse": string | null,
    "orderDate": string | null,
    "eventName": string,
    "eventDate": string | null,
    "lieuSalle": string | null,
    "categorie": string | null,
    "section": string | null,
    "rang": string | null,
    "seatFrom": string | null,
    "seatTo": string | null,
    "qty": number,
    "unitPrice": number,
    "source": string | null
  }
]
- "orderDate" = date de la commande/confirmation (pas la date de l'événement), format YYYY-MM-DD, ou null.
- "eventDate" = date de l'événement lui-même, format YYYY-MM-DD, ou null.
- Dates numériques ambiguës (ex: "08/10/2026", où jour et mois sont tous les deux ≤ 12) : les dates de COMMANDE viennent typiquement de billetteries américaines et sont en format américain MM/JJ/AAAA (mois en premier) - interprète-les comme telles sauf indice contraire explicite dans le texte. Les dates d'ÉVÉNEMENT suivent le format international JJ/MM/AAAA (jour en premier) sauf indice contraire. Si un des deux nombres est > 12, il n'y a pas d'ambiguïté : c'est forcément le jour, quel que soit le champ.
- "categorie" = le tier/la catégorie de placement globale (ex: "VIP Floor", "Golden Circle", "Cat 1"), pas une catégorie métier.
- "section" = le code/nom de section si mentionné (ex: "A2", "GC1"), sinon null.
- "rang" = le numéro de rangée si mentionné (ex: "4"), sinon null.
- "seatFrom"/"seatTo" = bornes numériques d'une plage de sièges si mentionnée (ex: "Seats 11-18" → seatFrom "11", seatTo "18"). Si un seul siège précis est donné, mets-le dans seatFrom et laisse seatTo à null. Si aucun numéro de siège n'est donné, laisse les deux à null.
- "qty" = nombre de billets identiques dans cette ligne précise (doit correspondre à la taille de la plage de sièges quand il y en a une).
- "unitPrice" = prix unitaire brut, dans la devise d'origine du texte, sans symbole (si seul un total pour la ligne est donné, divise par qty).
- "source" = site/billetterie d'achat si mentionné explicitement, sinon null.
- "motDePasse" = le mot de passe du compte si mentionné dans le texte, sinon null.
Si plusieurs commandes contiennent le même événement, NE LES FUSIONNE JAMAIS : garde une ligne séparée par commande, même si événement et prix sont identiques.
Si le texte demande explicitement d'ignorer/exclure une commande ou un billet, ne l'inclus pas dans le résultat.
Si aucune ligne exploitable n'est trouvée, réponds avec un tableau vide [].`;

export type ParsedClaudeRow = {
  numeroCommande: string | null;
  compte: string | null;
  motDePasse: string | null;
  orderDate: string | null;
  eventName: string;
  eventDate: string | null;
  lieuSalle: string | null;
  categorie: string | null;
  section: string | null;
  rang: string | null;
  seatFrom: string | null;
  seatTo: string | null;
  qty: number;
  unitPrice: number;
  source: string | null;
};

// Expansion déterministe des plages de sièges (ex: "Seats 11-18") en sièges individuels -
// plus fiable que de demander à Claude d'énumérer lui-même chaque numéro (risque d'erreur
// sur de grandes plages). Si la plage ne correspond pas à qty, ou qu'il n'y a pas de plage,
// on retombe sur des places génériques (section/rang connus, pas de numéro précis).
function expandSeats(row: ParsedClaudeRow): TicketmasterSeat[] {
  const section = row.section?.trim() || "";
  const rang = row.rang?.trim() || null;

  if (row.seatFrom && row.seatTo) {
    const from = Number(row.seatFrom);
    const to = Number(row.seatTo);
    if (Number.isInteger(from) && Number.isInteger(to) && to >= from && to - from + 1 === row.qty) {
      return Array.from({ length: row.qty }, (_, i) => ({
        section,
        rang,
        place: String(from + i),
        tag: null,
      }));
    }
  }
  if (row.seatFrom && !row.seatTo && row.qty === 1) {
    return [{ section, rang, place: row.seatFrom.trim(), tag: null }];
  }
  return Array.from({ length: row.qty }, () => ({ section, rang, place: null, tag: null }));
}

async function callClaude(rawText: string): Promise<ParsedClaudeRow[]> {
  const apiKey = process.env.anthropic_api_key;
  if (!apiKey) throw new Error("Clé API Claude non configurée côté serveur");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erreur API Claude (${res.status}) : ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
    (c) => c.type === "text"
  );
  if (!textBlock?.text) throw new Error("Réponse Claude vide ou inattendue");

  let jsonText = textBlock.text.trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonText = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Claude n'a pas renvoyé un JSON valide");
  }
  if (!Array.isArray(parsed)) throw new Error("Format de réponse Claude invalide");
  return parsed as ParsedClaudeRow[];
}

export type ParseListingTextInput = {
  rawText: string;
  isEur: boolean;
  exchangeRate: number | null; // 1 EUR = X <devise d'origine>
  feePct: number | null;
  defaultSource: string | null;
  defaultFolderName: string | null;
};

function convertToEur(unitPrice: number, input: ParseListingTextInput): number {
  if (input.isEur || !input.exchangeRate) return unitPrice;
  const fee = input.feePct ? input.feePct / 100 : 0;
  return Math.round((unitPrice / input.exchangeRate) * (1 + fee) * 100) / 100;
}

export async function parseListingText(input: ParseListingTextInput) {
  if (!input.rawText.trim()) throw new Error("Colle d'abord le texte du listing");

  const rows = await callClaude(input.rawText);

  let created = 0;
  for (const row of rows) {
    if (!row.eventName || !row.qty || row.qty < 1) continue;
    const coutAchatUnit = convertToEur(Number(row.unitPrice) || 0, input);
    const seats = expandSeats(row);
    // Le mot de passe est accolé à l'email dans recipientEmail (pas de colonne dédiée) pour
    // remonter automatiquement partout où le compte s'affiche déjà (dialogue de validation,
    // customValues.compte du StockItem final) sans toucher au reste du flux d'import.
    const recipientEmail = row.compte
      ? row.motDePasse
        ? `${row.compte} / ${row.motDePasse}`
        : row.compte
      : null;

    await prisma.importedListing.create({
      data: {
        provider: "CLAUDE_PASTE",
        gmailMessageId: `paste-${crypto.randomUUID()}`,
        numeroCommande: row.numeroCommande ?? null,
        recipientEmail,
        orderDate: row.orderDate ? new Date(`${row.orderDate}T00:00:00.000Z`) : null,
        eventName: row.eventName,
        eventDate: row.eventDate ? new Date(`${row.eventDate}T00:00:00.000Z`) : null,
        lieuSalle: row.lieuSalle ?? null,
        categorie: row.categorie ?? null,
        qty: row.qty,
        coutAchatUnit,
        seats,
        rawEmailText: input.rawText,
        source: row.source?.trim() || input.defaultSource || null,
        folderName: input.defaultFolderName?.trim() || null,
      },
    });
    created++;
  }

  for (const p of IMPORT_PAGES) revalidatePath(p);
  return { created, total: rows.length };
}
