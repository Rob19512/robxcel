"use client";

import { useCallback, useEffect, useState } from "react";

export type ColumnDef = { key: string; label: string };

// Colonnes affichées/masquées/réordonnées par l'utilisateur, mémorisées par navigateur
// (même préférence partout où le même tableau apparaît, ex. Billets/Merch/Prestations).
export function useColumnPrefs(storageKey: string, allKeys: string[]) {
  const fullKey = `robxcel:columns:${storageKey}`;
  const [order, setOrder] = useState<string[]>(allKeys);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { order?: string[]; hidden?: string[] };
        if (parsed.hidden) setHidden(new Set(parsed.hidden));
        if (parsed.order) {
          const known = new Set(allKeys);
          const merged = parsed.order.filter((k) => known.has(k));
          for (const k of allKeys) if (!merged.includes(k)) merged.push(k);
          setOrder(merged);
        }
      }
    } catch {
      // ignore
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const persist = useCallback(
    (nextOrder: string[], nextHidden: Set<string>) => {
      try {
        localStorage.setItem(fullKey, JSON.stringify({ order: nextOrder, hidden: Array.from(nextHidden) }));
      } catch {
        // ignore
      }
    },
    [fullKey]
  );

  const toggle = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persist(order, next);
        return next;
      });
    },
    [order, persist]
  );

  const move = useCallback(
    (key: string, direction: -1 | 1) => {
      setOrder((prev) => {
        const idx = prev.indexOf(key);
        const target = idx + direction;
        if (idx === -1 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[target]] = [next[target], next[idx]];
        persist(next, hidden);
        return next;
      });
    },
    [hidden, persist]
  );

  const isVisible = useCallback((key: string) => !(loaded && hidden.has(key)), [hidden, loaded]);

  return { order, isVisible, toggle, move };
}
