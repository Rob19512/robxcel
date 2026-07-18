"use client";

import { useMemo } from "react";
import { InlineText } from "@/components/inline-field";

// Le champ "Catégorie / Placement" reste stocké comme une seule chaîne (même clé,
// même recherche, même export CSV qu'avant) mais se saisit via 3 cases séparées -
// on parse la chaîne existante pour pré-remplir, puis on la recombine à chaque
// modification pour toujours obtenir le même format : "Catégorie, Rang X, Place Y".
export function parseCategoriePlacement(value: string) {
  const m = value.match(/^(.*?),\s*Rang\s+(.+?),\s*Place\s+(.+)$/i);
  if (m) return { categorie: m[1].trim(), rang: m[2].trim(), place: m[3].trim() };
  const mRang = value.match(/^(.*?),\s*Rang\s+(.+)$/i);
  if (mRang) return { categorie: mRang[1].trim(), rang: mRang[2].trim(), place: "" };
  const mPlace = value.match(/^(.*?),\s*Place\s+(.+)$/i);
  if (mPlace) return { categorie: mPlace[1].trim(), rang: "", place: mPlace[2].trim() };

  // Formats libres (autres billetteries, saisie manuelle) : "Rangée"/"Siège(s)" au lieu de
  // "Rang"/"Place", séparateurs variés (tirets, deux-points...) plutôt qu'un "," strict.
  // On extrait le rang/la place où qu'ils soient dans le texte au lieu d'exiger le format
  // exact, sinon le plan de placement ne peut pas regrouper ces billets par n° de siège.
  const rangLoose = value.match(/Rang(?:ée)?e?\s*:?\s*(\S+)/i);
  const placeLoose = value.match(/(?:Place|Si[èe]ge\(?s?\)?)\s*:?\s*(\S+)/i);
  if (rangLoose || placeLoose) {
    let categorie = value.trim();
    if (rangLoose) categorie = categorie.replace(rangLoose[0], "").trim();
    if (placeLoose) categorie = categorie.replace(placeLoose[0], "").trim();
    categorie = categorie.replace(/^[-,:;\s]+|[-,:;\s]+$/g, "").trim();
    return {
      categorie: categorie || value.trim(),
      rang: rangLoose ? rangLoose[1].replace(/[.,;:]+$/, "") : "",
      place: placeLoose ? placeLoose[1].replace(/[.,;:]+$/, "") : "",
    };
  }

  return { categorie: value.trim(), rang: "", place: "" };
}

export function combineCategoriePlacement(parts: { categorie: string; rang: string; place: string }) {
  const bits = [parts.categorie.trim()];
  if (parts.rang.trim()) bits.push(`Rang ${parts.rang.trim()}`);
  if (parts.place.trim()) bits.push(`Place ${parts.place.trim()}`);
  return bits.filter(Boolean).join(", ");
}

export function CategoriePlacementField({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const parsed = useMemo(() => parseCategoriePlacement(value), [value]);

  return (
    <div className="flex flex-col gap-0.5">
      <InlineText
        value={parsed.categorie}
        placeholder="Catégorie"
        onSave={(v) => onSave(combineCategoriePlacement({ ...parsed, categorie: v }))}
      />
      <div className="flex gap-0.5">
        <InlineText
          value={parsed.rang}
          placeholder="Rang"
          onSave={(v) => onSave(combineCategoriePlacement({ ...parsed, rang: v }))}
          className="w-16"
        />
        <InlineText
          value={parsed.place}
          placeholder="Place"
          onSave={(v) => onSave(combineCategoriePlacement({ ...parsed, place: v }))}
          className="w-20"
        />
      </div>
    </div>
  );
}
