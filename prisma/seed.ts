import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import type { CategoryKind, CategoryScope, FieldType } from "../src/generated/prisma/client";

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Compte admin prêt : ${email}`);
}

type FieldSpec = { key: string; label: string; fieldType: FieldType; sortOrder: number; showInStock?: boolean; showInSale?: boolean };
type CategorySpec = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  scope: CategoryScope;
  hasStock: boolean;
  trackPriorite?: boolean;
  trackRecu?: boolean;
  trackEvents?: boolean;
  showDescription?: boolean;
  showCompteEmail?: boolean;
  sortOrder: number;
  fields: FieldSpec[];
  sources: { label: string; appliesToStock?: boolean; appliesToSale?: boolean }[];
};

async function upsertCategory(spec: CategorySpec) {
  const category = await prisma.category.upsert({
    where: { id: spec.id },
    update: {
      trackPriorite: spec.trackPriorite ?? false,
      trackRecu: spec.trackRecu ?? false,
      trackEvents: spec.trackEvents ?? false,
      showDescription: spec.showDescription ?? true,
      showCompteEmail: spec.showCompteEmail ?? true,
      scope: spec.scope,
    },
    create: {
      id: spec.id,
      name: spec.name,
      emoji: spec.emoji,
      color: spec.color,
      kind: spec.kind,
      scope: spec.scope,
      hasStock: spec.hasStock,
      trackPriorite: spec.trackPriorite ?? false,
      trackRecu: spec.trackRecu ?? false,
      trackEvents: spec.trackEvents ?? false,
      showDescription: spec.showDescription ?? true,
      showCompteEmail: spec.showCompteEmail ?? true,
      isBuiltin: true,
      sortOrder: spec.sortOrder,
    },
  });

  for (const f of spec.fields) {
    await prisma.categoryField.upsert({
      where: { categoryId_key: { categoryId: category.id, key: f.key } },
      update: {},
      create: {
        categoryId: category.id,
        key: f.key,
        label: f.label,
        fieldType: f.fieldType,
        sortOrder: f.sortOrder,
        showInStock: f.showInStock ?? true,
        showInSale: f.showInSale ?? true,
      },
    });
  }

  for (const [i, s] of spec.sources.entries()) {
    await prisma.categorySource.upsert({
      where: { categoryId_label: { categoryId: category.id, label: s.label } },
      update: {},
      create: {
        categoryId: category.id,
        label: s.label,
        sortOrder: i,
        appliesToStock: s.appliesToStock ?? true,
        appliesToSale: s.appliesToSale ?? true,
      },
    });
  }

  return category;
}

const billetsFields: FieldSpec[] = [
  { key: "categoriePlacement", label: "Catégorie / Placement", fieldType: "TEXT", sortOrder: 0 },
  { key: "compte", label: "Compte", fieldType: "TEXT", sortOrder: 1 },
  { key: "numeroCommande", label: "Numéro de commande", fieldType: "TEXT", sortOrder: 2 },
  { key: "listingSite", label: "Listing site", fieldType: "TEXT", sortOrder: 3 },
];

const billetsSources = ["Viagogo", "Welist", "Seatiks", "Client direct", "Lysted"];
const merchSources = ["StockX", "Hypeboost", "Vinted", "Autre vente"];

async function seedCategories() {
  await upsertCategory({
    id: "cat-billets",
    name: "Billets",
    emoji: "🎫",
    color: "#6366f1",
    kind: "BIEN",
    scope: "PRO",
    hasStock: true,
    trackPriorite: true,
    trackEvents: true,
    showDescription: false,
    showCompteEmail: false,
    sortOrder: 0,
    fields: billetsFields,
    sources: billetsSources.map((label) => ({ label })),
  });

  await upsertCategory({
    id: "cat-prestations",
    name: "Prestations",
    emoji: "🛠️",
    color: "#10b981",
    kind: "SERVICE",
    scope: "PRO",
    hasStock: false,
    sortOrder: 1,
    fields: [],
    sources: [{ label: "Prestation commerciale", appliesToStock: false, appliesToSale: true }],
  });

  await upsertCategory({
    id: "cat-merch",
    name: "Sneakers / Merch",
    emoji: "👟",
    color: "#f59e0b",
    kind: "BIEN",
    scope: "PRO",
    hasStock: true,
    trackRecu: true,
    sortOrder: 2,
    fields: [{ key: "infosVente", label: "Infos vente", fieldType: "TEXT", sortOrder: 0, showInStock: false }],
    sources: merchSources.map((label) => ({ label })),
  });

  await upsertCategory({
    id: "cat-perso-billets",
    name: "Perso · Billets",
    emoji: "🎫",
    color: "#8b5cf6",
    kind: "BIEN",
    scope: "PERSO",
    hasStock: true,
    trackPriorite: true,
    trackEvents: true,
    showDescription: false,
    showCompteEmail: false,
    sortOrder: 10,
    fields: billetsFields,
    sources: billetsSources.map((label) => ({ label })),
  });

  await upsertCategory({
    id: "cat-perso-prestations",
    name: "Perso · Prestations",
    emoji: "🛠️",
    color: "#8b5cf6",
    kind: "SERVICE",
    scope: "PERSO",
    hasStock: false,
    sortOrder: 11,
    fields: [],
    sources: [{ label: "Prestation", appliesToStock: false, appliesToSale: true }],
  });

  await upsertCategory({
    id: "cat-perso-merch",
    name: "Perso · Merch",
    emoji: "👟",
    color: "#8b5cf6",
    kind: "BIEN",
    scope: "PERSO",
    hasStock: true,
    trackRecu: true,
    sortOrder: 12,
    fields: [],
    sources: merchSources.map((label) => ({ label })),
  });

  console.log("Catégories Pro (Billets/Prestations/Merch) et Perso prêtes.");
}

async function main() {
  await seedAdminUser();
  await seedCategories();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
