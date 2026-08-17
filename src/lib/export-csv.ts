import Papa from "papaparse";

export function downloadCsv(filename: string, rows: Record<string, unknown>[], delimiter: string = ";") {
  // Point-virgule par défaut : Excel en locale française attend ce séparateur (la virgule
  // sert de séparateur décimal) - avec une virgule, Excel désaligne les colonnes à
  // l'ouverture sans erreur visible, donnant l'impression que des données ont disparu.
  // Un export destiné à être ré-importé tel quel dans un autre logiciel (pas ouvert dans
  // Excel par l'utilisateur) doit en revanche passer explicitement "," - le standard CSV
  // que ce genre d'outil attend.
  const csv = Papa.unparse(rows, { delimiter });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
