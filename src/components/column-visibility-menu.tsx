"use client";

import { Columns3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/use-column-visibility";

export function ColumnVisibilityMenu({
  columns,
  order,
  isVisible,
  toggle,
  move,
}: {
  columns: ColumnDef[];
  order: string[];
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
}) {
  const labelByKey = new Map(columns.map((c) => [c.key, c.label]));
  const orderedKeys = order.filter((k) => labelByKey.has(k));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3 />
        Colonnes
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          Afficher / masquer / réordonner
        </div>
        <DropdownMenuSeparator />
        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto py-1">
          {orderedKeys.map((key, i) => (
            <div key={key} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm">
              <Checkbox checked={isVisible(key)} onCheckedChange={() => toggle(key)} />
              <span className="flex-1 truncate">{labelByKey.get(key)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                onClick={() => move(key, -1)}
                title="Déplacer vers la gauche"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === orderedKeys.length - 1}
                onClick={() => move(key, 1)}
                title="Déplacer vers la droite"
              >
                <ChevronRight />
              </Button>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
