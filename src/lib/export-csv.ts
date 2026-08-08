import Papa from "papaparse";

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  // Point-virgule : Excel en locale française attend ce séparateur par défaut pour le CSV
  // (la virgule sert de séparateur décimal) - avec une virgule, Excel désaligne les colonnes
  // à l'ouverture sans erreur visible, donnant l'impression que des données ont disparu.
  const csv = Papa.unparse(rows, { delimiter: ";" });
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
