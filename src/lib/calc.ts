export function computeSale(s: {
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
  tauxTvaVente: number;
  tauxTvaAchat: number;
}) {
  const totalEncaisse = s.qty * s.prixVenteUnit;
  const coutTotal = s.qty * s.coutAchatUnit;
  const margeBrute = totalEncaisse - coutTotal;
  const beneficeNet = margeBrute;
  const tvaCollectee =
    s.tauxTvaVente > 0 ? totalEncaisse * (s.tauxTvaVente / (100 + s.tauxTvaVente)) : 0;
  const tvaDeductibleAchat =
    s.tauxTvaAchat > 0 ? coutTotal * (s.tauxTvaAchat / (100 + s.tauxTvaAchat)) : 0;
  const beneficeNetApresTva = beneficeNet - tvaCollectee + tvaDeductibleAchat;

  return {
    totalEncaisse,
    coutTotal,
    margeBrute,
    beneficeNet,
    tvaCollectee,
    tvaDeductibleAchat,
    beneficeNetApresTva,
  };
}
