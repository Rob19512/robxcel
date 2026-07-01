import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

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

async function seedCategories() {
  const billets = await prisma.category.upsert({
    where: { id: "cat-billets" },
    update: {},
    create: {
      id: "cat-billets",
      name: "Billets",
      emoji: "🎫",
      color: "#6366f1",
      kind: "BIEN",
      hasStock: true,
      trackPriorite: true,
      isBuiltin: true,
      sortOrder: 0,
    },
  });

  const prestations = await prisma.category.upsert({
    where: { id: "cat-prestations" },
    update: {},
    create: {
      id: "cat-prestations",
      name: "Prestations",
      emoji: "🛠️",
      color: "#10b981",
      kind: "SERVICE",
      hasStock: false,
      isBuiltin: true,
      sortOrder: 1,
    },
  });

  const merch = await prisma.category.upsert({
    where: { id: "cat-merch" },
    update: {},
    create: {
      id: "cat-merch",
      name: "Sneakers / Merch",
      emoji: "👟",
      color: "#f59e0b",
      kind: "BIEN",
      hasStock: true,
      trackRecu: true,
      isBuiltin: true,
      sortOrder: 2,
    },
  });

  // Champs personnalisés des catégories builtin (mécanisme générique utilisé aussi pour les futures catégories custom)
  const billetsFields = [
    { key: "evenement", label: "Événement", fieldType: "TEXT" as const, sortOrder: 0 },
    { key: "dateEvenement", label: "Date événement", fieldType: "DATE" as const, sortOrder: 1 },
    { key: "lieuSalle", label: "Lieu / Salle", fieldType: "TEXT" as const, sortOrder: 2 },
    { key: "categoriePlacement", label: "Catégorie / Placement", fieldType: "TEXT" as const, sortOrder: 3 },
    { key: "infosVente", label: "Infos vente", fieldType: "TEXT" as const, sortOrder: 4 },
  ];

  for (const f of billetsFields) {
    await prisma.categoryField.upsert({
      where: { categoryId_key: { categoryId: billets.id, key: f.key } },
      update: {},
      create: { categoryId: billets.id, ...f, showInStock: true, showInSale: true },
    });
  }

  await prisma.categoryField.upsert({
    where: { categoryId_key: { categoryId: merch.id, key: "infosVente" } },
    update: {},
    create: {
      categoryId: merch.id,
      key: "infosVente",
      label: "Infos vente",
      fieldType: "TEXT",
      showInStock: false,
      showInSale: true,
      sortOrder: 0,
    },
  });

  // Sources par défaut
  const billetsSources = ["Viagogo", "Welist", "Seatiks", "Client direct", "Lysted"];
  for (const [i, label] of billetsSources.entries()) {
    await prisma.categorySource.upsert({
      where: { categoryId_label: { categoryId: billets.id, label } },
      update: {},
      create: { categoryId: billets.id, label, sortOrder: i, appliesToStock: true, appliesToSale: true },
    });
  }

  await prisma.categorySource.upsert({
    where: { categoryId_label: { categoryId: prestations.id, label: "Prestation commerciale" } },
    update: {},
    create: {
      categoryId: prestations.id,
      label: "Prestation commerciale",
      sortOrder: 0,
      appliesToStock: false,
      appliesToSale: true,
    },
  });

  const merchSources = ["StockX", "Hypeboost", "Vinted", "Autre vente"];
  for (const [i, label] of merchSources.entries()) {
    await prisma.categorySource.upsert({
      where: { categoryId_label: { categoryId: merch.id, label } },
      update: {},
      create: { categoryId: merch.id, label, sortOrder: i, appliesToStock: true, appliesToSale: true },
    });
  }

  console.log("Catégories Billets / Prestations / Merch prêtes.");
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
