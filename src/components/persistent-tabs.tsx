"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

// Garde l'onglet actif dans l'URL (?tab=...) pour qu'un rechargement de page (F5) reste
// sur le même onglet au lieu de retomber sur celui par défaut.
export function PersistentTabs({
  defaultValue,
  paramKey = "tab",
  children,
}: {
  defaultValue: string;
  paramKey?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramKey) ?? defaultValue;

  function handleValueChange(next: unknown) {
    if (typeof next !== "string") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      {children}
    </Tabs>
  );
}
