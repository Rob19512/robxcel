"use client";

import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/use-column-visibility";

export function ColumnVisibilityMenu({
  columns,
  isVisible,
  toggle,
}: {
  columns: ColumnDef[];
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3 />
        Colonnes
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Afficher / masquer</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.key}
              closeOnClick={false}
              checked={isVisible(c.key)}
              onCheckedChange={() => toggle(c.key)}
            >
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
