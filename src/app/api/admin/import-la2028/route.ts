import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Route temporaire, à usage unique : import en masse des billets JO LA2028 fournis par
// l'utilisateur. Protégée par un secret lu depuis une variable d'env Vercel (jamais commité) ;
// fichier + variable supprimés juste après usage.
function d(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

const EVENTS = [
  { code: "ATH05", name: "Athletics (Track & Field) Mixed Final", date: "2028-07-17", lieu: "LA Memorial Coliseum" },
  { code: "CER02", name: "Closing Ceremony", date: "2028-07-30", lieu: "LA Memorial Coliseum" },
  { code: "BK320", name: "3x3 Basketball Mixed Final", date: "2028-07-22", lieu: "Valley Complex 3" },
  { code: "SWM17", name: "Swimming Mixed Final", date: "2028-07-30", lieu: "2028 Stadium" },
  { code: "FBL57", name: "Football (Soccer) Men's Final", date: "2028-07-28", lieu: "Rose Bowl Stadium" },
  { code: "BSB12", name: "Baseball Men's Final", date: "2028-07-19", lieu: "Dodger Stadium" },
  { code: "FBL05", name: "Football (Soccer) Men's Preliminary", date: "2028-07-10", lieu: "Nashville Stadium" },
  { code: "HOC27", name: "Hockey Men's Semifinal", date: "2028-07-26", lieu: "Carson Field" },
  { code: "HOC28", name: "Hockey Men's Semifinal", date: "2028-07-26", lieu: "Carson Field" },
  { code: "HOC32", name: "Hockey Men's Final", date: "2028-07-28", lieu: "Carson Field" },
  { code: "FBL29", name: "Football (Soccer) Men's Preliminary", date: "2028-07-16", lieu: "New York Stadium" },
  { code: "FBL45", name: "Football (Soccer) Men's Quarterfinal", date: "2028-07-20", lieu: "St. Louis Stadium" },
  { code: "FBL46", name: "Football (Soccer) Men's Quarterfinal", date: "2028-07-20", lieu: "New York Stadium" },
  { code: "HBL44", name: "Handball Men's Final", date: "2028-07-27", lieu: "Long Beach Arena" },
  { code: "FBL20", name: "Football (Soccer) Men's Preliminary", date: "2028-07-13", lieu: "Nashville Stadium" },
] as const;

// Conversion USD -> EUR : 1€ = 1.1393$, + 0.6% de frais de change (débit réel constaté).
const RATE = 1.1393;
const FEE = 0.006;
function eurFromUsd(usd: number) {
  return Math.round((usd / RATE) * (1 + FEE) * 100) / 100;
}

const GROUPS = [
  { order: "391530234", compte: "kooky-expat.0t@icloud.com", event: "ATH05", cat: "I", qty: 4, usd: 43.41 },
  { order: "391530234", compte: "kooky-expat.0t@icloud.com", event: "CER02", cat: "F", qty: 2, usd: 440.31 },
  { order: "391530234", compte: "kooky-expat.0t@icloud.com", event: "BK320", cat: "C", qty: 4, usd: 235.66 },
  { order: "391530234", compte: "kooky-expat.0t@icloud.com", event: "SWM17", cat: "G", qty: 2, usd: 186.05 },
  { order: "391530234", compte: "kooky-expat.0t@icloud.com", event: "FBL57", cat: "E", qty: 12, usd: 281.40 },
  { order: "391536960", compte: "the-ray-coleman@outlook.com", event: "BSB12", cat: "E", qty: 4, usd: 446.51 },
  { order: "391536960", compte: "the-ray-coleman@outlook.com", event: "FBL05", cat: "F", qty: 12, usd: 28.00 },
  { order: "391593798", compte: "yaizabe46394_sl@outlook.com", event: "HOC27", cat: "D", qty: 2, usd: 49.61 },
  { order: "391593798", compte: "yaizabe46394_sl@outlook.com", event: "HOC28", cat: "D", qty: 6, usd: 49.61 },
  { order: "391557418", compte: "shawnagarrette4578@outlook.com", event: "HOC32", cat: "D", qty: 2, usd: 74.42 },
  { order: "391557418", compte: "shawnagarrette4578@outlook.com", event: "FBL29", cat: "F", qty: 2, usd: 28.00 },
  { order: "391540230", compte: "shawnagarrette4578@outlook.com", event: "FBL45", cat: "F", qty: 2, usd: 28.00 },
  { order: "391540230", compte: "shawnagarrette4578@outlook.com", event: "FBL46", cat: "F", qty: 4, usd: 28.00 },
  { order: "391540230", compte: "shawnagarrette4578@outlook.com", event: "HOC32", cat: "D", qty: 4, usd: 74.42 },
  { order: "391540230", compte: "shawnagarrette4578@outlook.com", event: "HBL44", cat: "D", qty: 4, usd: 62.02 },
  { order: "391568733", compte: "lavas_wise00@icloud.com", event: "HOC32", cat: "D", qty: 4, usd: 74.42 },
  { order: "391562052", compte: "lavas_wise00@icloud.com", event: "FBL20", cat: "F", qty: 12, usd: 28.00 },
  { order: "391540283", compte: "lavas_wise00@icloud.com", event: "HOC32", cat: "D", qty: 4, usd: 74.42 },
  { order: "391604271", compte: "rebeccaw_6369@outlook.com", event: "HOC27", cat: "D", qty: 6, usd: 49.61 },
] as const;

const SITE_NAME = "LA28 Official Tickets";
const FOLDER_NAME = "LA 2028";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-import-secret");
  if (!process.env.la2028_import_secret || secret !== process.env.la2028_import_secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const category = await prisma.category.findFirst({
    where: { name: "Billets", scope: "PRO" },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie Billets (PRO) introuvable" }, { status: 500 });
  }

  const existingFolder = await prisma.eventFolder.findFirst({
    where: { categoryId: category.id, name: FOLDER_NAME },
    include: { events: true },
  });
  if (existingFolder && existingFolder.events.length > 0) {
    return NextResponse.json({
      skipped: true,
      reason: "Le dossier LA 2028 existe déjà avec des événements, import déjà effectué",
    });
  }

  const folder =
    existingFolder ??
    (await prisma.eventFolder.create({
      data: { categoryId: category.id, name: FOLDER_NAME },
    }));

  await prisma.ticketingSite.upsert({
    where: { name: SITE_NAME },
    update: {},
    create: { name: SITE_NAME, tauxTvaAchat: 0 },
  });

  const eventIdByCode = new Map<string, string>();
  for (const e of EVENTS) {
    const created = await prisma.event.create({
      data: {
        categoryId: category.id,
        name: `${e.code} – ${e.name}`,
        dateEvenement: d(e.date),
        lieuSalle: e.lieu,
        folderId: folder.id,
      },
    });
    eventIdByCode.set(e.code, created.id);
  }

  const today = new Date();
  const rows: {
    categoryId: string;
    dateAchat: Date;
    source: string;
    eventId: string;
    qty: number;
    coutAchatUnit: number;
    tauxTvaAchat: number;
    customValues: { categoriePlacement: string; compte: string; numeroCommande: string };
  }[] = [];

  for (const g of GROUPS) {
    const eventId = eventIdByCode.get(g.event);
    if (!eventId) continue;
    const eur = eurFromUsd(g.usd);
    for (let i = 0; i < g.qty; i++) {
      rows.push({
        categoryId: category.id,
        dateAchat: today,
        source: SITE_NAME,
        eventId,
        qty: 1,
        coutAchatUnit: eur,
        tauxTvaAchat: 0,
        customValues: {
          categoriePlacement: `Catégorie ${g.cat}`,
          compte: g.compte,
          numeroCommande: g.order,
        },
      });
    }
  }

  const result = await prisma.stockItem.createMany({ data: rows });

  return NextResponse.json({
    ok: true,
    folderId: folder.id,
    eventsCreated: eventIdByCode.size,
    stockItemsCreated: result.count,
  });
}
