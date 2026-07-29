"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TicketmasterSeat } from "@/lib/gmail/ticketmaster-parser";

const BILLETS_PATH = "/billets";
const CLAUDE_MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Tu extrais des listings de billets à partir d'un texte collé par l'utilisateur (confirmations de commande, listes de billets, etc.).
Réponds UNIQUEMENT avec un tableau JSON (pas de texte autour, pas de balises markdown), où chaque élément représente UNE ligne d'événement (un groupe de billets identiques pour un même événement, dans une même commande) avec ce format exact :
[
  {
    "numeroCommande": string | null,
    "compte": string | null,
    "eventName": string,
    "eventDate": string | null,
    "lieuSalle": string | null,
    "categorie": string | null,
    "qty": number,
    "unitPrice": number,
    "source": string | null
  }
]
- "eventDate" au format YYYY-MM-DD, ou null si absente.
- "categorie" = la catégorie/tier de placement du billet (ex: "F", "Cat 1"), pas une catégorie métier.
- "qty" = nombre de billets identiques dans cette ligne précise.
- "unitPrice" = prix unitaire brut, dans la devise d'origine du texte, sans symbole.
- "source" = site/billetterie d'achat si mentionné explicitement, sinon null.
Si plusieurs commandes contiennent le même événement, NE LES FUSIONNE JAMAIS : garde une ligne séparée par commande, même si événement et prix sont identiques.
Si le texte demande explicitement d'ignorer/exclure une commande ou un billet, ne l'inclus pas dans le résultat.
Si aucune ligne exploitable n'est trouvée, réponds avec un tableau vide [].`;

export type ParsedClaudeRow = {
  numeroCommande: string | null;
  compte: string | null;
  eventName: string;
  eventDate: string | null;
  lieuSalle: string | null;
  categorie: string | null;
  qty: number;
  unitPrice: number;
  source: string | null;
};

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
    // section reste vide : la catégorie/tier est déjà portée par listing.categorie et
    // combinée avec seat.section dans placementFor() (import-actions.ts) - la dupliquer
    // ici donnerait "X - Catégorie X" dans le champ Catégorie/Placement du stock.
    const seats: TicketmasterSeat[] = Array.from({ length: row.qty }, () => ({
      section: "",
      rang: null,
      place: null,
      tag: null,
    }));

    await prisma.importedListing.create({
      data: {
        provider: "CLAUDE_PASTE",
        gmailMessageId: `paste-${crypto.randomUUID()}`,
        numeroCommande: row.numeroCommande ?? null,
        recipientEmail: row.compte ?? null,
        orderDate: null,
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

  revalidatePath(BILLETS_PATH);
  return { created, total: rows.length };
}
