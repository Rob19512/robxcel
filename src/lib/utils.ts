import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Colonne figée à gauche d'un tableau large (1re colonne identifiante, ex Date/Nom) pour
// garder la ligne repérable en scrollant horizontalement vers les colonnes de droite.
// À utiliser via StickyTableHead/StickyTableCell (table.tsx) : le sticky + fond doivent
// vivre sur la <div> interne que ces composants fournissent, pas sur le <th>/<td> — sinon
// le fond de la cellule (couche de peinture spéciale en CSS table) ne masque pas fiablement
// le contenu des cellules voisines qui défilent en dessous.
// Une seule colonne figée par tableau (pas de checkbox en plus) : deux cellules sticky
// adjacentes avec des offsets différents cassent le rendu en Chromium (le contenu défilé
// re-transparaît à travers, testé et confirmé) — une seule colonne figée n'a pas ce souci.
export const STICKY_COL =
  "sticky left-0 z-10 border-r bg-background group-hover:bg-muted group-data-[state=selected]:bg-muted";
