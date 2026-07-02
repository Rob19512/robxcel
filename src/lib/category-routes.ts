export const CATEGORY_ROUTES: Record<string, string> = {
  "cat-billets": "/billets",
  "cat-prestations": "/prestations",
  "cat-merch": "/merch",
  "cat-perso-billets": "/perso/billets",
  "cat-perso-prestations": "/perso/prestations",
  "cat-perso-merch": "/perso/merch",
};

export const A_ENCAISSER_PATH = "/a-encaisser";

export function categoryRoute(categoryId: string) {
  return CATEGORY_ROUTES[categoryId] ?? `/categories/${categoryId}`;
}
