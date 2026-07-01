import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AidePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mode d&apos;emploi</h1>
        <p className="text-sm text-muted-foreground">
          La logique du site, en résumé.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deux dates, deux vues</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Date de vente</strong> = quand tu vends.{" "}
            <strong className="text-foreground">Date d&apos;encaissement</strong> = quand l&apos;argent arrive
            vraiment (souvent plus tard).
          </p>
          <p>
            Le tableau de bord et les graphiques proposent une bascule{" "}
            <strong className="text-foreground">Encaissé</strong> (trésorerie réelle) /{" "}
            <strong className="text-foreground">Vente</strong> (performance commerciale, y compris ce qui
            n&apos;est pas encore payé).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow stock → vente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            <li>Tu ajoutes un article en stock (billet, merch) → statut 📦 En stock.</li>
            <li>Tu remplis la date de vente → statut ⏳ En attente.</li>
            <li>
              Tu remplis la date d&apos;encaissement → une vente est créée automatiquement, l&apos;article
              passe ✅ Vendu et sort du stock actif (mais reste consultable via &quot;Afficher les vendus&quot;).
            </li>
          </ol>
          <p>Action rapide : le bouton ✅ à côté d&apos;une date vide la remplit avec aujourd&apos;hui, en un clic.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vente ou Prestation ?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Une <strong className="text-foreground">Vente</strong> = tu revends un bien (billet, sneakers...).
            Une <strong className="text-foreground">Prestation</strong> = tu factures un service. Chaque
            catégorie a un type fixe (Billets/Merch = biens, Prestations = service), donc pas de confusion
            possible ligne par ligne.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seuils TVA (franchise en base)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">85 000 €</Badge>
            <span>Ventes de biens — Billets + Merch cumulés (Pro uniquement).</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">37 500 €</Badge>
            <span>Prestations de services (Pro uniquement).</span>
          </div>
          <p>
            Le Perso ne compte jamais dans ces seuils, quel que soit le filtre affiché sur le tableau de
            bord.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Événements (Billets)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Crée un événement une seule fois (nom + date + lieu) dans l&apos;onglet &quot;Événements&quot;,
            puis choisis-le dans la liste pour chaque billet en stock ou en vente. Si un même artiste joue
            plusieurs dates, crée un événement par date pour ne pas mélanger les compteurs.
          </p>
          <p>
            L&apos;onglet Événements affiche, pour chacun : billets restants en stock, vendus, CA réalisé et
            bénéfice. Le bouton &quot;Voir les tickets&quot; détaille la liste précise.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routine mensuelle conseillée</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            <li>Pointer les encaissements reçus dans le mois (dates d&apos;encaissement à jour).</li>
            <li>Ajouter les nouveaux achats pro du mois (Achats pro).</li>
            <li>Vérifier les seuils TVA sur le tableau de bord.</li>
            <li>En fin de trimestre : consulter TVA trimestrielle pour la déclaration.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TVA trimestrielle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Calculée sur les encaissements (Pro uniquement). Dates de dépôt :</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>T1 (Jan-Mar) : avant le 30/04</li>
            <li>T2 (Avr-Juin) : avant le 31/07</li>
            <li>T3 (Juil-Sept) : avant le 31/10</li>
            <li>T4 (Oct-Déc) : avant le 31/01 de l&apos;année suivante</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
