"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineDate } from "@/components/inline-field";
import { eur } from "@/lib/format";
import {
  createEvent,
  updateEventField,
  deleteEvent,
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
  const [isPending, startTransition] = useTransition();

  const filtered = initialEvents.filter((e) => {
    if (!search.trim()) return true;
    return [e.name, e.lieuSalle, e.notes].join(" ").toLowerCase().includes(search.toLowerCase());
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
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} événement{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Nom</TableHead>
                <TableHead className="min-w-32">Date</TableHead>
                <TableHead className="min-w-48">Lieu / Salle</TableHead>
                <TableHead className="min-w-28">En stock</TableHead>
                <TableHead className="min-w-28">Vendus</TableHead>
                <TableHead className="min-w-28">CA réalisé</TableHead>
                <TableHead className="min-w-28">Bénéfice</TableHead>
                <TableHead className="min-w-48">Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const stats = statsFor(e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <InlineText value={e.name} onSave={saveField(e.id, "name")} testId="event-name" />
                    </TableCell>
                    <TableCell>
                      <InlineDate value={e.dateEvenement ?? ""} onSave={saveField(e.id, "dateEvenement")} />
                    </TableCell>
                    <TableCell>
                      <InlineText value={e.lieuSalle ?? ""} onSave={saveField(e.id, "lieuSalle")} />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{stats.nbEnStock}</TableCell>
                    <TableCell className="text-center tabular-nums">{stats.nbVendus}</TableCell>
                    <TableCell className="text-center tabular-nums">{eur.format(stats.ca)}</TableCell>
                    <TableCell className="text-center tabular-nums font-medium">
                      {eur.format(stats.benefice)}
                    </TableCell>
                    <TableCell>
                      <InlineText value={e.notes ?? ""} onSave={saveField(e.id, "notes")} />
                    </TableCell>
                    <TableCell>
                      <RowMenu onDelete={() => handleDelete(e.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun événement pour l&apos;instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((e) => {
          const stats = statsFor(e.id);
          return (
            <Card key={e.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <InlineText
                    value={e.name}
                    onSave={saveField(e.id, "name")}
                    className="text-base font-medium"
                  />
                  <RowMenu onDelete={() => handleDelete(e.id)} />
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
                <Field label="Notes">
                  <InlineText value={e.notes ?? ""} onSave={saveField(e.id, "notes")} />
                </Field>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun événement pour l&apos;instant.</p>
        )}
      </div>
    </div>
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
