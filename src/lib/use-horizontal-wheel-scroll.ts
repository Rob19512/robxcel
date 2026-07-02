"use client";

import { useEffect, useRef } from "react";

// Permet de faire défiler un tableau large horizontalement avec la molette de la
// souris (au lieu d'avoir à attraper la fine barre de défilement en bas), sans
// gêner le scroll vertical normal de la page quand le tableau n'a pas de dépassement.
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const node = el!;
      if (node.scrollWidth <= node.clientWidth) return;
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
