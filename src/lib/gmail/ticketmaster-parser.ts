const MONTHS: Record<string, number> = {
  jan: 0, janv: 0,
  feb: 1, fev: 1, fév: 1, févr: 1,
  mar: 2, mars: 2,
  apr: 3, avr: 3,
  may: 4, mai: 4,
  jun: 5, juin: 5,
  jul: 6, juil: 6,
  aug: 7, aou: 7, août: 7,
  sep: 8, sept: 8,
  oct: 9,
  nov: 10,
  dec: 11, dece: 11, déc: 11,
};

export type TicketmasterSeat = {
  section: string;
  rang: string | null;
  place: string | null;
  tag: string | null;
};

export type ParsedTicketmasterOrder = {
  numeroCommande: string;
  eventName: string;
  eventDate: Date | null;
  lieuSalle: string | null;
  categorie: string | null;
  qty: number;
  coutAchatUnit: number;
  seats: TicketmasterSeat[];
};

function isSeparatorLine(line: string): boolean {
  return /^[-=_\s]{3,}$/.test(line);
}

// html-to-text ajoute "[url]" après le texte des liens/images (ex: alt d'une image bannière) ;
// on l'enlève pour ne garder que le texte lisible.
function stripTrailingLink(line: string): string {
  return line.replace(/\s*\[https?:\/\/[^\]]*\]\s*$/, "").trim();
}

function normalizeWhitespace(text: string): string {
  // Les emails Ticketmaster utilisent des espaces insécables (ex: "20 :00") ; on les
  // ramène à des espaces normaux pour que les regex restent simples.
  return text.replace(/[  ]/g, " ");
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function parseEventDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-zéûî]{3,10})\s+(\d{4})\s+(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return null;
  const [, day, monthRaw, year, hour, minute] = m;
  const month = MONTHS[monthRaw.toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(year), month, Number(day), Number(hour), Number(minute));
}

function extractOrderNumber(subject: string, text: string): string | null {
  const fromSubject = subject.match(/commande\s+(\d+)/i);
  if (fromSubject) return fromSubject[1];
  const fromText = text.match(/commande\s+n[°ºo]?\s*(\d+)/i);
  return fromText ? fromText[1] : null;
}

function extractEventName(text: string): string | null {
  const detailIdx = text.search(/D[ée]tail de votre commande/i);
  const dateIdx = text.search(/\d{1,2}\s+[A-Za-zéûî]{3,10}\s+\d{4}\s+\d{1,2}\s*:\s*\d{2}/);
  if (detailIdx === -1 || dateIdx === -1 || dateIdx <= detailIdx) return null;

  const block = text
    .slice(detailIdx, dateIdx)
    .split("\n")
    .map((l) => stripTrailingLink(l.trim()))
    .filter(Boolean)
    .filter((l) => !isSeparatorLine(l))
    .filter((l) => !/^D[ée]tail de votre commande$/i.test(l));

  const unique = [...new Set(block)];
  return unique[0] ?? null;
}

function extractVenue(text: string): string | null {
  const dateIdx = text.search(/\d{1,2}\s+[A-Za-zéûî]{3,10}\s+\d{4}\s+\d{1,2}\s*:\s*\d{2}/);
  const qtyIdx = text.search(/\d+\s*billets?/i);
  if (dateIdx === -1 || qtyIdx === -1 || qtyIdx <= dateIdx) return null;

  const dateLineEnd = text.indexOf("\n", dateIdx);
  const block = text
    .slice(dateLineEnd === -1 ? dateIdx : dateLineEnd, qtyIdx)
    .split("\n")
    .map((l) => stripTrailingLink(l.trim()))
    .filter(Boolean)
    .filter((l) => !isSeparatorLine(l));

  const unique = [...new Set(block)];
  const candidates = unique.filter((l) => /[A-Za-zÀ-ÿ]/.test(l) && l.length < 100);
  if (candidates.length === 0) return null;
  // La ligne la plus longue est généralement la plus complète (ex: "STADE DE FRANCE, ST DENIS"
  // plutôt que juste "STADE DE FRANCE").
  return candidates.sort((a, b) => b.length - a.length)[0].replace(/,\s*$/, "");
}

function extractSeats(text: string): TicketmasterSeat[] {
  const seats: TicketmasterSeat[] = [];
  const re = /^(.+?)\s*-\s*Rang\s*(\S+)\s*-\s*Place\s*(\S+?)(?:\s*-\s*(.+))?$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    seats.push({
      section: m[1].trim(),
      rang: m[2]?.trim() || null,
      place: m[3]?.trim() || null,
      tag: m[4]?.trim() || null,
    });
  }
  return seats;
}

// Billetterie générale (pelouse, fosse...) : pas de rang/place, juste une ligne
// "Placement XXX" - on crée une entrée par billet avec le même placement.
function extractGeneralAdmissionSeats(text: string, qty: number): TicketmasterSeat[] {
  const m = text.match(/^Placement(?:\s+(\S+))?\s*$/im);
  if (!m) return [];
  const section = m[1] ? `Placement ${m[1].trim()}` : "Placement";
  return Array.from({ length: Math.max(1, qty) }, () => ({
    section,
    rang: null,
    place: null,
    tag: null,
  }));
}

export function parseTicketmasterEmail(subject: string, rawText: string): ParsedTicketmasterOrder | null {
  const text = normalizeWhitespace(rawText);

  const numeroCommande = extractOrderNumber(subject, text);
  if (!numeroCommande) return null;

  const seats = extractSeats(text);
  const qtyMatch = text.match(/(\d+)\s*billets?/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : seats.length || 1;

  const finalSeats = seats.length > 0 ? seats : extractGeneralAdmissionSeats(text, qty);
  if (finalSeats.length === 0) return null;

  const eventName = extractEventName(text) ?? "Événement inconnu";
  const eventDate = parseEventDate(text);
  const lieuSalle = extractVenue(text);
  const categorieMatch = text.match(/CAT[ÉE]GORIE\s*([^\n]+)/i);
  const categorie = categorieMatch ? categorieMatch[1].trim() : null;

  const total = parseAmount(text.match(/Total de la commande\s*[\t: ]*\s*([\d.,]+)\s*€/i)?.[1]);
  const unitFromLine = parseAmount(text.match(/\d+\s*x\s*([\d.,]+)\s*€/i)?.[1]);
  const coutAchatUnit = total !== null && qty > 0 ? Math.round((total / qty) * 100) / 100 : (unitFromLine ?? 0);

  return {
    numeroCommande,
    eventName,
    eventDate,
    lieuSalle,
    categorie,
    qty,
    coutAchatUnit,
    seats: finalSeats,
  };
}
