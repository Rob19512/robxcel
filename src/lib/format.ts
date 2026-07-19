export const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export const TVA_RATES = [0, 2.1, 5.5, 10, 20];

export function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function parseDateInputValue(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatRoi(roi: number | null): string {
  if (roi === null) return "—";
  return `${roi >= 0 ? "+" : ""}${roi.toFixed(0)} %`;
}

// Les prix unitaires saisis dans l'app sont TTC (ce qui a vraiment été payé/reçu) - le HT
// s'en déduit à partir du taux de TVA, jamais l'inverse.
export function prixHt(montantTtc: number, tauxTva: number): number {
  return tauxTva > 0 ? montantTtc * (100 / (100 + tauxTva)) : montantTtc;
}
