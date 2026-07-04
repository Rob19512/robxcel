"use client";

import { useCallback, useEffect, useState } from "react";

export type ColumnDef = { key: string; label: string };

// Colonnes cachées par l'utilisateur, mémorisées par navigateur (même préférence
// partout où le même tableau apparaît, ex. Billets/Merch/Prestations).
export function useColumnVisibility(storageKey: string) {
  const fullKey = `robxcel:hidden-columns:${storageKey}`;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) setHidden(new Set(JSON.parse(raw)));
    } catch {
      // ignore
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const toggle = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        try {
          localStorage.setItem(fullKey, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [fullKey]
  );

  const isVisible = useCallback((key: string) => !(loaded && hidden.has(key)), [hidden, loaded]);

  return { isVisible, toggle, hidden };
}
