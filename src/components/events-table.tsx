"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnPrefs, type ColumnDef } from "@/lib/use-column-visibility";
import { useColumnSort, compareValues } from "@/lib/use-column-sort";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Trash2, Eye, ArrowUp, ArrowDown, Table2, LayoutGrid, MapPin, CalendarDays } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StickyTableHead,
  StickyTableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineDate, InlineSelect } from "@/components/inline-field";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { EventFolderControls } from "@/components/event-folder-controls";
import { eur, formatRoi } from "@/lib/format";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createEvent,
  updateEventField,
  deleteEvent,
  bulkDeleteEvents,
  updateEventFolder,
  createEventFolder,
  renameEventFolder,
  deleteEventFolder,
  type EventField,
} from "@/lib/actions/event-actions";
import type { StockRow } from "@/components/stock-table";
import type { SaleRow } from "@/components/sales-table";

export type EventRow = {
  id: string;
  name: string;
  dateEvenement: string | null;
  lieuSalle: string | null;
  notes: string | null;
  folderId: string | null;
};

export type EventFolderOption = { id: string; name: string };

const EVENTS_VIEW_STORAGE_KEY = "robxcel:events-view-mode";

function useEventsViewMode() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(EVENTS_VIEW_STORAGE_KEY);
      if (stored === "table" || stored === "cards") setViewMode(stored);
    } catch {
      // ignore
    }
  }, []);
  function updateViewMode(next: "table" | "cards") {
    setViewMode(next);
    try {
      localStorage.setItem(EVENTS_VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  return [viewMode, updateViewMode] as const;
}

// Jours restants avant l'événement (négatif = déjà passé) - sert à colorer le badge
// "J-X" pour repérer d'un coup d'œil ce qui approche et n'est pas encore vendu.
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const eventDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
}

export function EventsTable({
  categoryId,
  path,
  initialEvents,
  stockItems,
  sales,
  folders,
}: {
  categoryId: string;
  path: string;
  initialEvents: EventRow[];
  stockItems: StockRow[];
  sales: SaleRow[];
  folders: EventFolderOption[];
}) {
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useEventsViewMode();
  const [isPending, startTransition] = useTransition();
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const columnKeys = ["dossier", "date", "lieuSalle", "vendus", "ca", "benefice"];
  const { order, isVisible, toggle: toggleColumn, move: moveColumn } = useColumnPrefs("events", columnKeys);
  const { sort: columnSort, toggleSort } = useColumnSort();
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));
  const folderOptions = [{ value: "", label: "Aucun dossier" }, ...folders.map((f) => ({ value: f.id, label: f.name }))];
  const columns: ColumnDef[] = [
    { key: "dossier", label: "Dossier" },
    { key: "date", label: "Date" },
    { key: "lieuSalle", label: "Lieu / Salle" },
    { key: "vendus", label: "Vendus" },
    { key: "ca", label: "CA réalisé" },
    { key: "benefice", label: "Bénéfice" },
  ];
  const visibleOrderedKeys = order.filter(isVisible);
  const labelByKey = new Map(columns.map((c) => [c.key, c.label]));
  function headClassName(key: string) {
    const widths: Record<string, string> = {
      dossier: "min-w-40",
      date: "min-w-32",
      lieuSalle: "min-w-48",
      vendus: "min-w-28",
      ca: "min-w-28",
      benefice: "min-w-28",
    };
    return widths[key] ?? "min-w-36";
  }
  function renderBodyCell(key: string, e: EventRow, stats: ReturnType<typeof statsFor>) {
    switch (key) {
      case "dossier":
        return <InlineSelect value={e.folderId ?? ""} options={folderOptions} onSave={saveFolder(e.id)} />;
      case "date":
        return <InlineDate value={e.dateEvenement ?? ""} onSave={saveField(e.id, "dateEvenement")} />;
      case "lieuSalle":
        return <InlineText value={e.lieuSalle ?? ""} onSave={saveField(e.id, "lieuSalle")} />;
      case "vendus":
        return `${stats.nbVendus}/${stats.nbVendus + stats.nbEnStock}`;
      case "ca":
        return eur.format(stats.ca);
      case "benefice":
        return (
          <span className="text-emerald-600 dark:text-emerald-500">
            {eur.format(stats.benefice)} <span className="text-xs">({formatRoi(stats.roi)})</span>
          </span>
        );
      default:
        return null;
    }
  }

  function sortValueFor(key: string, e: EventRow): string | number | null {
    switch (key) {
      case "name":
        return e.name;
      case "dossier":
        return e.folderId ? folderNameById.get(e.folderId) ?? null : null;
      case "date":
        return e.dateEvenement;
      case "lieuSalle":
        return e.lieuSalle;
      case "vendus":
        return statsFor(e.id).nbVendus;
      case "ca":
        return statsFor(e.id).ca;
      case "benefice":
        return statsFor(e.id).benefice;
      default:
        return null;
    }
  }

  const filtered = initialEvents.filter((e) => {
    if (folderFilter && e.folderId !== folderFilter) return false;
    if (!search.trim()) return true;
    return normalizeForSearch([e.name, e.lieuSalle, e.notes].join(" ")).includes(normalizeForSearch(search));
  });
  if (columnSort) {
    const { key, dir } = columnSort;
    filtered.sort((a, b) => {
      const cmp = compareValues(sortValueFor(key, a), sortValueFor(key, b));
      return dir === "asc" ? cmp : -cmp;
    });
  }

  function handleAdd() {
    startTransition(async () => {
      try {
        await createEvent(categoryId, path);
      } catch {
        toast.error("Impossible d'ajouter l'événement");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteEvent(id, path);
        toast.success("Événement supprimé (les billets liés restent, juste dé-liés)");
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id))
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkDeleteEvents(ids, path);
        setSelectedIds(new Set());
        toast.success(
          `${ids.length} événement${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""} (billets liés juste dé-liés)`
        );
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function saveField(id: string, field: EventField) {
    return (value: string) => updateEventField(id, path, field, value);
  }

  function saveFolder(id: string) {
    return (value: string) => updateEventFolder(id, path, value || null);
  }

  function statsFor(eventId: string) {
    const eventStock = stockItems.filter((s) => s.eventId === eventId);
    // "En attente" = déjà vendu, juste pas encore encaissé (n'existe qu'en StockItem
    // tant que l'encaissement n'est pas saisi) : ça compte comme "vendu", pas "en stock".
    const trueEnStock = eventStock.filter((s) => s.statut === "EN_STOCK");
    const pending = eventStock.filter((s) => s.statut === "EN_ATTENTE");
    const nbEnStock = trueEnStock.reduce((sum, s) => sum + s.qty, 0);

    const eventSales = sales.filter((s) => s.eventId === eventId);

    const nbVendus =
      eventSales.reduce((sum, s) => sum + s.qty, 0) + pending.reduce((sum, s) => sum + s.qty, 0);
    const ca =
      eventSales.reduce((sum, s) => sum + s.qty * s.prixVenteUnit, 0) +
      pending.reduce((sum, s) => sum + s.qty * (s.prixCibleVente ?? 0), 0);
    const benefice =
      eventSales.reduce((sum, s) => sum + (s.qty * s.prixVenteUnit - s.qty * s.coutAchatUnit), 0) +
      pending.reduce((sum, s) => sum + (s.qty * (s.prixCibleVente ?? 0) - s.qty * s.coutAchatUnit), 0);
    // ROI = bénéfice rapporté au coût d'achat de ce qui est vendu (combien j'ai gagné pour
    // chaque euro investi) - null si rien n'est encore vendu (pas de coût à rapporter).
    const coutVendu =
      eventSales.reduce((sum, s) => sum + s.qty * s.coutAchatUnit, 0) +
      pending.reduce((sum, s) => sum + s.qty * s.coutAchatUnit, 0);
    const roi = coutVendu > 0 ? (benefice / coutVendu) * 100 : null;
    // Retail total = coût d'achat total (tout ce qui a été investi dans ce lot, vendu ou
    // non) - à comparer au CA (vente globale). Le coût vit uniquement sur le StockItem
    // (repris tel quel sur la Sale au moment de la promotion), donc on somme eventStock
    // sans jamais toucher aux Sales pour éviter tout double comptage.
    const retail = eventStock.reduce((sum, s) => sum + s.qty * s.coutAchatUnit, 0);

    return { nbEnStock, nbVendus, ca, benefice, retail, coutVendu, roi };
  }

  // Cumul du bénéf/CA sur les événements cochés (ex : tous les matchs d'une compétition)
  // Par défaut (rien de coché), le total porte sur tout ce qui est actuellement filtré
  // (recherche/dossier) ; cocher des lignes permet de le restreindre à un sous-ensemble.
  const summaryStats = useMemo(() => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map((e) => e.id);
    let nbEnStock = 0;
    let nbVendus = 0;
    let ca = 0;
    let benefice = 0;
    let retail = 0;
    let coutVendu = 0;
    for (const id of ids) {
      const s = statsFor(id);
      nbEnStock += s.nbEnStock;
      nbVendus += s.nbVendus;
      ca += s.ca;
      benefice += s.benefice;
      retail += s.retail;
      coutVendu += s.coutVendu;
    }
    // Le ROI global se recalcule sur les totaux cumulés, jamais comme une moyenne des
    // ROI par événement (sinon un petit événement pèserait autant qu'un gros).
    const roi = coutVendu > 0 ? (benefice / coutVendu) * 100 : null;
    return { count: ids.length, nbEnStock, nbVendus, ca, benefice, retail, roi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, filtered, stockItems, sales]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter un événement
        </Button>
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <EventFolderControls
          folders={folders}
          activeFolderId={folderFilter}
          onFilterChange={setFolderFilter}
          onCreate={(name) => createEventFolder(categoryId, path, name)}
          onRename={(id, name) => renameEventFolder(id, path, name)}
          onDelete={(id) => deleteEventFolder(id, path)}
        />
        {viewMode === "table" && (
          <ColumnVisibilityMenu columns={columns} order={order} isVisible={isVisible} toggle={toggleColumn} move={moveColumn} />
        )}
        {viewMode === "cards" && (
          <ToggleGroup
            value={columnSort ? [columnSort.key] : []}
            onValueChange={(v) => v[0] && toggleSort(v[0])}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="date">Date</ToggleGroupItem>
            <ToggleGroupItem value="name">Nom</ToggleGroupItem>
            <ToggleGroupItem value="ca">CA</ToggleGroupItem>
            <ToggleGroupItem value="benefice">Bénéfice</ToggleGroupItem>
          </ToggleGroup>
        )}
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} permanent />
        <ToggleGroup
          value={[viewMode]}
          onValueChange={(v) => v[0] && setViewMode(v[0] as typeof viewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="table" title="Vue tableau">
            <Table2 />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" title="Vue cartes">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} événement{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {summaryStats.count > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-6 py-4">
            <span className="text-sm font-medium">
              {selectedIds.size > 0
                ? `${selectedIds.size} événement${selectedIds.size > 1 ? "s" : ""} sélectionné${selectedIds.size > 1 ? "s" : ""}`
                : folderFilter && folderNameById.get(folderFilter)
                  ? folderNameById.get(folderFilter)
                  : `${summaryStats.count} événement${summaryStats.count > 1 ? "s" : ""} affiché${summaryStats.count > 1 ? "s" : ""}`}
            </span>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-lg font-semibold tabular-nums">{eur.format(summaryStats.retail)}</p>
                <p className="text-xs text-muted-foreground">Retail total</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">{eur.format(summaryStats.ca)}</p>
                <p className="text-xs text-muted-foreground">CA total</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-500">
                  {eur.format(summaryStats.benefice)}{" "}
                  <span className="text-sm">({formatRoi(summaryStats.roi)})</span>
                </p>
                <p className="text-xs text-muted-foreground">Bénéf. total (ROI)</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {summaryStats.nbVendus}/{summaryStats.nbVendus + summaryStats.nbEnStock}
                </p>
                <p className="text-xs text-muted-foreground">Vendus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desktop table */}
      <Card className={cn("overflow-hidden py-0", viewMode === "table" ? "hidden md:block" : "hidden")}>
        <Table containerRef={scrollRef}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <StickyTableHead
                  className="min-w-48 cursor-pointer select-none"
                  stickyClassName={STICKY_COL}
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    Nom
                    {columnSort?.key === "name" &&
                      (columnSort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </span>
                </StickyTableHead>
                {visibleOrderedKeys.map((key) => (
                  <TableHead
                    key={key}
                    className={cn(headClassName(key), "cursor-pointer select-none hover:bg-muted/50")}
                    onClick={() => toggleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {labelByKey.get(key)}
                      {columnSort?.key === key &&
                        (columnSort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const stats = statsFor(e.id);
                return (
                  <TableRow key={e.id} data-state={selectedIds.has(e.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelected(e.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineText value={e.name} onSave={saveField(e.id, "name")} testId="event-name" />
                    </StickyTableCell>
                    {visibleOrderedKeys.map((key) => (
                      <TableCell
                        key={key}
                        className={cn(
                          ["vendus", "ca", "benefice"].includes(key) && "text-center tabular-nums",
                          key === "benefice" && "font-medium"
                        )}
                      >
                        {renderBodyCell(key, e, stats)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Voir les tickets"
                          onClick={() => setDetailEventId(e.id)}
                        >
                          <Eye />
                        </Button>
                        <RowMenu onDelete={() => handleDelete(e.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun événement pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </Card>

      {/* Cartes : vue par défaut sur desktop (viewMode "cards"), toujours utilisée sur mobile
          quel que soit le mode choisi (le tableau large n'y tient pas). */}
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3",
          viewMode === "cards" ? "md:grid-cols-2 xl:grid-cols-3" : "md:hidden"
        )}
      >
        {filtered.map((e) => {
          const stats = statsFor(e.id);
          const totalTickets = stats.nbVendus + stats.nbEnStock;
          const pctVendu = totalTickets > 0 ? (stats.nbVendus / totalTickets) * 100 : 0;
          const days = daysUntil(e.dateEvenement);
          const isPast = days !== null && days < 0;
          const isUrgent = days !== null && days >= 0 && days <= 7 && stats.nbEnStock > 0;
          const isSoon = days !== null && days >= 0 && days <= 30;

          return (
            <Card key={e.id} className="gap-0 overflow-hidden py-0">
              <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelected(e.id)} />
                  <InlineText value={e.name} onSave={saveField(e.id, "name")} className="text-sm font-semibold" />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {days !== null && (
                    <Badge
                      className={cn(
                        "tabular-nums",
                        isPast && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                        !isPast && isUrgent && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                        !isPast && !isUrgent && isSoon && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                        !isPast && !isUrgent && !isSoon && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      )}
                    >
                      {isPast ? "Terminé" : `J-${days}`}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon-sm" title="Voir les tickets" onClick={() => setDetailEventId(e.id)}>
                    <Eye />
                  </Button>
                  <RowMenu onDelete={() => handleDelete(e.id)} />
                </div>
              </div>
              <CardContent className="flex flex-col gap-3 pt-3">
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 shrink-0" />
                    <InlineDate value={e.dateEvenement ?? ""} onSave={saveField(e.id, "dateEvenement")} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <InlineText value={e.lieuSalle ?? ""} onSave={saveField(e.id, "lieuSalle")} placeholder="Lieu / Salle" />
                  </div>
                  <Field label="Dossier">
                    <InlineSelect value={e.folderId ?? ""} options={folderOptions} onSave={saveFolder(e.id)} />
                  </Field>
                </div>
                <div className="flex flex-col gap-1">
                  <Progress value={pctVendu} />
                  <p className="text-xs text-muted-foreground">
                    {stats.nbVendus}/{totalTickets} vendus
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">CA réalisé</span>
                    <p className="font-medium tabular-nums">{eur.format(stats.ca)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bénéfice (ROI)</span>
                    <p className="font-medium tabular-nums text-emerald-600 dark:text-emerald-500">
                      {eur.format(stats.benefice)} <span className="text-xs">({formatRoi(stats.roi)})</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</p>
        )}
      </div>

      <EventDetailSheet
        event={initialEvents.find((e) => e.id === detailEventId) ?? null}
        stockItems={stockItems.filter((s) => s.eventId === detailEventId)}
        sales={sales.filter((s) => s.eventId === detailEventId)}
        onClose={() => setDetailEventId(null)}
      />
    </div>
  );
}

const STOCK_STATUT_LABEL: Record<StockRow["statut"], string> = {
  EN_STOCK: "📦 En stock",
  EN_ATTENTE: "⏳ En attente",
  VENDU: "✅ Vendu",
};

const SALE_STATUT_LABEL: Record<SaleRow["statut"], string> = {
  ENCAISSE: "✅ Encaissé",
  EN_ATTENTE: "⏳ En attente",
  LITIGE: "⚠️ Litige",
};

function EventDetailSheet({
  event,
  stockItems,
  sales,
  onClose,
}: {
  event: EventRow | null;
  stockItems: StockRow[];
  sales: SaleRow[];
  onClose: () => void;
}) {
  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{event?.name}</SheetTitle>
          <SheetDescription>
            {[event?.dateEvenement, event?.lieuSalle].filter(Boolean).join(" — ") || "Détail des tickets liés"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Billets achetés (stock) — {stockItems.length}
            </h3>
            <div className="flex flex-col gap-2">
              {stockItems.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{s.description || "Sans description"}</span>
                    <span className="text-xs text-muted-foreground">
                      Qté {s.qty} · Coût {eur.format(s.coutAchatUnit)} · Cible{" "}
                      {s.prixCibleVente !== null ? eur.format(s.prixCibleVente) : "—"}
                    </span>
                  </div>
                  <Badge variant="secondary">{STOCK_STATUT_LABEL[s.statut]}</Badge>
                </div>
              ))}
              {stockItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun billet en stock lié.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Ventes — {sales.length}
            </h3>
            <div className="flex flex-col gap-2">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{s.description || "Sans description"}</span>
                    <span className="text-xs text-muted-foreground">
                      Qté {s.qty} · Vendu {eur.format(s.prixVenteUnit)} · Vente le{" "}
                      {s.dateVente.split("-").reverse().join("/")}
                    </span>
                  </div>
                  <Badge variant="secondary">{SALE_STATUT_LABEL[s.statut]}</Badge>
                </div>
              ))}
              {sales.length === 0 && <p className="text-sm text-muted-foreground">Aucune vente liée.</p>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function RowMenu({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" data-testid="row-actions" />}>
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
