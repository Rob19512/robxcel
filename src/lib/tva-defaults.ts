// Avant la date d'assujettissement, tout reste à 0% quel que soit le taux par défaut
// configuré sur la catégorie - sinon changer un taux par défaut modifierait aussi le passé
// (des ventes faites sous franchise en base, où 0% était le taux légal, pas un oubli).
export function effectiveTauxTva(
  defaultRate: number | null | undefined,
  assujettiDepuis: Date | null,
  date: Date
): number {
  if (!assujettiDepuis) return 0;
  if (date < assujettiDepuis) return 0;
  return defaultRate ?? 0;
}

// TVA déductible sur l'achat des billets : dépend du site de billetterie (chaque site
// facture sa propre TVA selon son pays d'établissement/régime, réglable dans /tva), pas de
// la catégorie - prioritaire sur le taux par défaut de la catégorie quand le site est connu.
export function resolveTauxTvaAchat(
  siteRate: number | null | undefined,
  categoryDefaultRate: number | null | undefined,
  assujettiDepuis: Date | null,
  date: Date
): number {
  return effectiveTauxTva(siteRate ?? categoryDefaultRate, assujettiDepuis, date);
}
