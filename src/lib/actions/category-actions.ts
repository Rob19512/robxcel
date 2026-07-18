"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categoryRoute } from "@/lib/category-routes";

function slugify(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "champ"
  );
}

export type NewCategoryInput = {
  name: string;
  emoji: string;
  color: string;
  kind: "BIEN" | "SERVICE";
  scope: "PRO" | "PERSO";
  hasStock: boolean;
  trackPriorite: boolean;
  trackRecu: boolean;
  trackEvents: boolean;
};

export async function createCategory(input: NewCategoryInput) {
  const count = await prisma.category.count();
  const category = await prisma.category.create({
    data: {
      name: input.name.trim() || "Nouvelle catégorie",
      emoji: input.emoji || "📦",
      color: input.color || "#6366f1",
      kind: input.kind,
      scope: input.scope,
      hasStock: input.hasStock,
      trackPriorite: input.hasStock ? input.trackPriorite : false,
      trackRecu: input.hasStock ? input.trackRecu : false,
      trackEvents: input.trackEvents,
      isBuiltin: false,
      sortOrder: count + 1,
    },
  });
  revalidatePath("/categories");
  revalidateTag("categories-nav", "max");
  return { id: category.id, route: categoryRoute(category.id) };
}

export type CategoryCoreField =
  | "name"
  | "emoji"
  | "color"
  | "kind"
  | "scope"
  | "hasStock"
  | "trackPriorite"
  | "trackRecu"
  | "trackEvents"
  | "showDescription"
  | "showCompteEmail";

export async function updateCategoryField(
  id: string,
  path: string,
  field: CategoryCoreField,
  value: string
) {
  const data: Record<string, unknown> = {};
  switch (field) {
    case "hasStock":
    case "trackPriorite":
    case "trackRecu":
    case "trackEvents":
    case "showDescription":
    case "showCompteEmail":
      data[field] = value === "true";
      break;
    case "name":
      data.name = value.trim() || "Sans nom";
      break;
    default:
      data[field] = value;
  }
  await prisma.category.update({ where: { id }, data });
  revalidatePath(path);
  revalidatePath("/categories");
  revalidateTag("categories-nav", "max");
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id } });
  if (category.isBuiltin) {
    throw new Error("Les catégories de base ne peuvent pas être supprimées.");
  }
  const [salesCount, stockCount] = await Promise.all([
    prisma.sale.count({ where: { categoryId: id, deletedAt: null } }),
    prisma.stockItem.count({ where: { categoryId: id, deletedAt: null } }),
  ]);
  if (salesCount > 0 || stockCount > 0) {
    throw new Error(
      `Cette catégorie contient encore ${salesCount} vente(s) et ${stockCount} article(s) en stock. Supprime-les d'abord.`
    );
  }
  // Les ventes/articles déjà mis à la corbeille (deletedAt non null) restent en base
  // pour permettre le bouton "Annuler" — mais ça bloque la suppression de la catégorie
  // (contrainte RESTRICT). Comme la catégorie part définitivement, on purge ces restes.
  await prisma.$transaction([
    prisma.sale.deleteMany({ where: { categoryId: id } }),
    prisma.stockItem.deleteMany({ where: { categoryId: id } }),
    prisma.category.delete({ where: { id } }),
  ]);
  revalidatePath("/categories");
  revalidateTag("categories-nav", "max");
}

export async function createCategoryField(
  categoryId: string,
  path: string,
  label: string,
  fieldType: "TEXT" | "NUMBER" | "DATE"
) {
  const count = await prisma.categoryField.count({ where: { categoryId } });
  let key = slugify(label);
  const existing = await prisma.categoryField.findUnique({
    where: { categoryId_key: { categoryId, key } },
  });
  if (existing) key = `${key}_${count}`;

  await prisma.categoryField.create({
    data: {
      categoryId,
      key,
      label: label.trim() || "Champ",
      fieldType,
      showInStock: true,
      showInSale: true,
      sortOrder: count,
    },
  });
  revalidatePath(path);
}

export async function deleteCategoryField(id: string, path: string) {
  await prisma.categoryField.delete({ where: { id } });
  revalidatePath(path);
}

export async function createCategorySource(categoryId: string, path: string, label: string) {
  const count = await prisma.categorySource.count({ where: { categoryId } });
  await prisma.categorySource.upsert({
    where: { categoryId_label: { categoryId, label: label.trim() || "Source" } },
    update: {},
    create: {
      categoryId,
      label: label.trim() || "Source",
      appliesToStock: true,
      appliesToSale: true,
      sortOrder: count,
    },
  });
  revalidatePath(path);
}

export async function deleteCategorySource(id: string, path: string) {
  await prisma.categorySource.delete({ where: { id } });
  revalidatePath(path);
}
