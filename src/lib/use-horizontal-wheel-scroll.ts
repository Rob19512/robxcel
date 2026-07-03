"use client";

import { useEffect, useRef } from "react";

// Permet de faire défiler un tableau large horizontalement avec Shift + molette (la
// convention standard des navigateurs pour scroller latéralement à la souris), en plus
// du pavé tactile (glissement horizontal, déjà géré nativement par le navigateur).
// Un scroll vertical normal (sans Shift) ne doit JAMAIS être détourné : la molette doit
// rester intuitive pour descendre dans la page, y compris quand elle survole un tableau.
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const node = el!;
      if (!e.shiftKey) return;
      if (node.scrollWidth <= node.clientWidth) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
