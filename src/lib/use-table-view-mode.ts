"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "robxcel:table-view-mode";

export type TableViewMode = "table" | "cards";

export function useTableViewMode() {
  const [viewMode, setViewMode] = useState<TableViewMode>("table");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "cards" || stored === "table") setViewMode(stored);
    } catch {
      // ignore
    }
  }, []);
  function updateViewMode(next: TableViewMode) {
    setViewMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  return [viewMode, updateViewMode] as const;
}
