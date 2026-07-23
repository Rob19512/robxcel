"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "robxcel:table-view-mode";

export type TableViewMode = "table" | "cards" | "seatmap";

export function useTableViewMode() {
  // "cards" par défaut : le tableau a accumulé trop de colonnes (prix HT, TVA achat/vente,
  // marge...) pour tenir à l'écran sans scroller loin à droite à chaque ligne - les cartes
  // n'ont pas ce problème (tout s'empile verticalement). Le tableau reste disponible pour qui
  // le préfère, via le sélecteur de vue (préférence alors mémorisée dans le localStorage).
  const [viewMode, setViewMode] = useState<TableViewMode>("cards");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "cards" || stored === "table" || stored === "seatmap") setViewMode(stored);
    } catch {
      // ignore
    }
  }, []);
  function updateViewMode(next: TableViewMode) {
    setViewMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  return [viewMode, updateViewMode] as const;
}
