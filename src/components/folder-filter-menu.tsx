"use client";

import { useState } from "react";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizeForSearch } from "@/lib/utils";

// Menu déroulant avec recherche plutôt qu'une rangée de boutons à bascule (ToggleGroup) -
// devient illisible dès qu'il y a beaucoup de dossiers. Même schéma que ColumnVisibilityMenu
// (checkboxes en liste scrollable dans un DropdownMenu, pas de DropdownMenuItem/CheckboxItem
// pour éviter que le menu se ferme à chaque coche).
export function FolderFilterMenu({
  folders,
  selectedIds,
  onChange,
}: {
  folders: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? folders.filter((f) => normalizeForSearch(f.name).includes(normalizeForSearch(search)))
    : folders;

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Folder />
        Dossier{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-1.5">
          <Input
            className="h-8"
            placeholder="Rechercher un dossier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucun dossier trouvé.</p>
          )}
          {filtered.map((f) => (
            <label
              key={f.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
            >
              <Checkbox checked={selectedIds.includes(f.id)} onCheckedChange={() => toggle(f.id)} />
              <span className="flex-1 truncate">{f.name}</span>
            </label>
          ))}
        </div>
        {selectedIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
                Effacer la sélection ({selectedIds.length})
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
