"use client";

import { useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnPrefs, type ColumnDef } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Trash2, Eye } from "lucide-react";
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
import { InlineText, InlineDate } from "@/components/inline-field";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { eur } from "@/lib/format";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createEvent,
  updateEventField,
  deleteEvent,
  bulkDeleteEvents,
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
};

export function EventsTable({
  categoryId,
  path,
  initialEvents,
  stockItems,
  sales,
}: {
  categoryId: string;
  path: string;
  initialEvents: EventRow[];
  stockItems: StockRow[];
  sales: SaleRow[];
}) {
  const [search, setSearch] = useState("");
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const columnKeys = ["date", "lieuSalle", "enStock", "vendus", "ca", "benefice"];
  const { order, isVisible, toggle: toggleColumn, move: moveColumn } = useColumnPrefs("events", columnKeys);
  const columns: ColumnDef[] = [
    { key: "date", label: "Date" },
    { key: "lieuSalle", label: "Lieu / Salle" },
    { key: "enStock", label: "En stock" },
    { key: "vendus", label: "Vendus" },
    { key: "ca", label: "CA réalisé" },
    { key: "benefice", label: "Bénéfice" },
  ];
  const visibleOrderedKeys = order.filter(isVisible);
  const labelByKey = new Map(columns.map((c) => [c.key, c.label]));
  function headClassName(key: string) {
    const widths: Record<string, string> = {
      date: "min-w-32",
      lieuSalle: "min-w-48",
      enStock: "min-w-28",
      vendus: "min-w-28",
      ca: "min-w-28",
      benefice: "min-w-28",
    };
    return widths[key] ?? "min-w-36";
  }
  function renderBodyCell(key: string, e: EventRow, stats: ReturnType<typeof statsFor>) {
    switch (key) {
      case "date":
        return <InlineDate value={e.dateEvenement ?? ""} onSave={saveField(e.id, "dateEvenement")} />;
      case "lieuSalle":
        return <InlineText value={e.lieuSalle ?? ""} onSave={saveField(e.id, "lieuSalle")} />;
      case "enStock":
        return stats.nbEnStock;
      case "vendus":
        return stats.nbVendus;
      case "ca":
        return eur.format(stats.ca);
      case "benefice":
        return eur.format(stats.benefice);
      default:
        return null;
    }
  }

  const filtered = initialEvents.filter((e) => {
    if (!search.trim()) return true;
    return normalizeForSearch([e.name, e.lieuSalle, e.notes].join(" ")).includes(normalizeForSearch(search));
  });

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

  function statsFor(eventId: string) {
    const enStock = stockItems.filter((s) => s.eventId === eventId && s.statut !== "VENDU");
    const nbEnStock = enStock.reduce((sum, s) => sum + s.qty, 0);
    const eventSales = sales.filter((s) => s.eventId === eventId);
    const nbVendus = eventSales.reduce((sum, s) => sum + s.qty, 0);
    const ca = eventSales.reduce((sum, s) => sum + s.qty * s.prixVenteUnit, 0);
    const benefice = eventSales.reduce(
      (sum, s) => sum + (s.qty * s.prixVenteUnit - s.qty * s.coutAchatUnit),
      0
    );
    return { nbEnStock, nbVendus, ca, benefice };
  }

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
        <ColumnVisibilityMenu columns={columns} order={order} isVisible={isVisible} toggle={toggleColumn} move={moveColumn} />
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} permanent />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} événement{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table containerRef={scrollRef}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <StickyTableHead className="min-w-48" stickyClassName={STICKY_COL}>Nom</StickyTableHead>
                {visibleOrderedKeys.map((key) => (
                  <TableHead key={key} className={headClassName(key)}>
                    {labelByKey.get(key)}
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
                          ["enStock", "vendus", "ca", "benefice"].includes(key) && "text-center tabular-nums",
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

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((e) => {
          const stats = statsFor(e.id);
          return (
            <Card key={e.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelected(e.id)} />
                    <InlineText
                      value={e.name}
                      onSave={saveField(e.id, "name")}
                      className="text-base font-medium"
                    />
                  </div>
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
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date">
                    <InlineDate value={e.dateEvenement ?? ""} onSave={saveField(e.id, "dateEvenement")} />
                  </Field>
                  <Field label="Lieu / Salle">
                    <InlineText value={e.lieuSalle ?? ""} onSave={saveField(e.id, "lieuSalle")} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">En stock</span>
                    <p className="font-medium tabular-nums">{stats.nbEnStock}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vendus</span>
                    <p className="font-medium tabular-nums">{stats.nbVendus}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CA réalisé</span>
                    <p className="font-medium tabular-nums">{eur.format(stats.ca)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bénéfice</span>
                    <p className="font-medium tabular-nums">{eur.format(stats.benefice)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</p>
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
