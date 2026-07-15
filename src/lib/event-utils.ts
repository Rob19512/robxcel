// Un événement est "passé" à partir du lendemain de sa date (le jour même, il reste
// proposé - utile pour les ventes de dernière minute) : on ne le propose alors plus
// dans les menus déroulants, mais un billet déjà lié à cet événement continue de
// l'afficher normalement (juste retiré de la liste des choix pour les nouvelles lignes).
export function isEventPast(dateEvenement: string | null): boolean {
  if (!dateEvenement) return false;
  const eventDate = new Date(`${dateEvenement}T00:00:00.000Z`);
  if (Number.isNaN(eventDate.getTime())) return false;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return todayUtc > eventDate.getTime();
}
