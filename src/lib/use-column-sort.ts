"use client";

import { useState } from "react";

export type ColumnSort = { key: string; dir: "asc" | "desc" } | null;

// Cliquer sur un en-tête de colonne trie par cette colonne : 1er clic = croissant,
// 2e clic = décroissant, 3e clic = retour au tri par défaut du tableau.
export function useColumnSort() {
  const [sort, setSort] = useState<ColumnSort>(null);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return { sort, toggleSort };
}

export function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
