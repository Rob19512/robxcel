"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {start}–{end} sur {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
