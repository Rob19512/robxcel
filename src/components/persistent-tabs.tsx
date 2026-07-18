"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

// Garde l'onglet actif dans l'URL (?tab=...) pour qu'un rechargement de page (F5) reste
// sur le même onglet au lieu de retomber sur celui par défaut.
//
// Important : on met à jour l'URL via l'API History du navigateur directement, pas
// router.replace() de Next - celui-ci déclenche une navigation qui refait tourner tout
// category-page.tsx côté serveur (categorie + ventes + stock + événements + import Gmail)
// à chaque clic d'onglet, alors que le contenu est déjà chargé côté client. C'est ce qui
// rendait le changement d'onglet lent (quelques secondes à chaque fois).
export function PersistentTabs({
  defaultValue,
  paramKey = "tab",
  children,
}: {
  defaultValue: string;
  paramKey?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Valeur initiale lue une seule fois depuis l'URL (correcte dès le rendu serveur, donc
  // pas de flash au chargement) ; ensuite l'état local est la seule source de vérité.
  const [value, setValue] = useState(() => searchParams.get(paramKey) ?? defaultValue);

  function handleValueChange(next: unknown) {
    if (typeof next !== "string") return;
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    params.set(paramKey, next);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      {children}
    </Tabs>
  );
}
