export const SEUIL_IS_REDUIT = 42500;
export const TAUX_IS_REDUIT = 0.15;
export const TAUX_IS_NORMAL = 0.25;

export function calculIS(beneficeImposable: number) {
  const benefice = Math.max(0, beneficeImposable);
  const trancheReduite = Math.min(benefice, SEUIL_IS_REDUIT);
  const trancheNormale = Math.max(0, benefice - SEUIL_IS_REDUIT);
  const isReduit = trancheReduite * TAUX_IS_REDUIT;
  const isNormal = trancheNormale * TAUX_IS_NORMAL;
  return {
    trancheReduite,
    trancheNormale,
    isReduit,
    isNormal,
    total: isReduit + isNormal,
  };
}
