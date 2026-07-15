"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isEventPast } from "@/lib/event-utils";
import { createEventWithDetails } from "@/lib/actions/event-actions";
import { bulkCreateStockItems, type BulkStockRowInput } from "@/lib/actions/stock-actions";
import type { EventOption } from "@/components/sales-table";

type EventFolderOption = { id: string; name: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

// "35-38" -> ["35","36","37","38"] ; sinon la valeur telle quelle (ou "" si vide).
function parseSeatRange(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [""];
  const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) {
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (end >= start && end - start < 500) {
      const seats: string[] = [];
      for (let i = start; i <= end; i++) seats.push(String(i));
      return seats;
    }
  }
  return [trimmed];
}

function buildPlacement(categorie: string, section: string, rang: string, seat: string) {
  const catPart = [categorie.trim(), section.trim()].filter(Boolean).join(" - ");
  const bits = [catPart];
  if (rang.trim()) bits.push(`Rang ${rang.trim()}`);
  if (seat.trim()) bits.push(`Place ${seat.trim()}`);
  return bits.filter(Boolean).join(", ");
}

export function CreateListingDialog({
  categoryId,
  path,
  events,
  folders,
  sources,
}: {
  categoryId: string;
  path: string;
  events?: EventOption[];
  folders: EventFolderOption[];
  sources: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [eventMode, setEventMode] = useState<"existing" | "new">("new");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventLieuSalle, setNewEventLieuSalle] = useState("");
  const [newEventFolderId, setNewEventFolderId] = useState("");

  const [dateAchat, setDateAchat] = useState(today());
  const [source, setSource] = useState("");
  const [categorie, setCategorie] = useState("");
  const [section, setSection] = useState("");
  const [rang, setRang] = useState("");
  const [seat, setSeat] = useState("");
  const [qty, setQty] = useState("1");
  const [coutAchatUnit, setCoutAchatUnit] = useState("");
  const [prixCibleVente, setPrixCibleVente] = useState("");
  const [numeroCommande, setNumeroCommande] = useState("");
  const [compteEmail, setCompteEmail] = useState("");

  const eventsSorted = [
    ...(events ?? []).filter((e) => !isEventPast(e.dateEvenement)),
    ...(events ?? []).filter((e) => isEventPast(e.dateEvenement)),
  ];
  const seatCount = parseSeatRange(seat).length;

  function reset() {
    setEventMode("new");
    setSelectedEventId("");
    setNewEventName("");
    setNewEventDate("");
    setNewEventLieuSalle("");
    setNewEventFolderId("");
    setDateAchat(today());
    setSource("");
    setCategorie("");
    setSection("");
    setRang("");
    setSeat("");
    setQty("1");
    setCoutAchatUnit("");
    setPrixCibleVente("");
    setNumeroCommande("");
    setCompteEmail("");
  }

  const canSubmit =
    (eventMode === "existing" ? !!selectedEventId : !!newEventName.trim()) &&
    !!dateAchat &&
    !!coutAchatUnit;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsPending(true);
    try {
      let eventId: string | null = null;
      if (eventMode === "new" && newEventName.trim()) {
        eventId = await createEventWithDetails(categoryId, path, {
          name: newEventName,
          dateEvenement: newEventDate || null,
          lieuSalle: newEventLieuSalle || null,
          folderId: newEventFolderId || null,
        });
      } else if (eventMode === "existing" && selectedEventId) {
        eventId = selectedEventId;
      }

      const seats = parseSeatRange(seat);
      const rows: BulkStockRowInput[] = seats.map((seatValue) => ({
        dateAchat,
        description: "",
        source,
        eventId,
        qty: seats.length > 1 ? 1 : Math.max(1, Number(qty) || 1),
        coutAchatUnit: Number(coutAchatUnit) || 0,
        prixCibleVente: prixCibleVente.trim() ? Number(prixCibleVente) : null,
        priorite: null,
        recu: null,
        compteEmail,
        notes: "",
        customValues: {
          categoriePlacement: buildPlacement(categorie, section, rang, seatValue),
          numeroCommande,
        },
      }));

      const { count } = await bulkCreateStockItems(categoryId, path, rows);
      toast.success(`${count} billet${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""} au stock`);
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de créer le listing");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PackagePlus />
        Créer un listing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un listing</DialogTitle>
            <DialogDescription>
              Renseigne tout en une fois. Pour plusieurs sièges d&apos;affilée, mets une plage
              dans "Place" (ex : 35-38 pour les places 35 à 38) : un billet sera créé pour
              chaque place.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Événement</h3>
              <ToggleGroup
                value={[eventMode]}
                onValueChange={(v) => v[0] && setEventMode(v[0] as typeof eventMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="new">Nouvel événement</ToggleGroupItem>
                <ToggleGroupItem value="existing">Événement existant</ToggleGroupItem>
              </ToggleGroup>

              {eventMode === "existing" ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Choisir l&apos;événement</Label>
                  <Select value={selectedEventId} onValueChange={(v) => setSelectedEventId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventsSorted.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label>Nom de l&apos;événement</Label>
                    <Input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} placeholder="Ex : Bad Bunny" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Date de l&apos;événement</Label>
                    <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Lieu / Salle</Label>
                    <Input value={newEventLieuSalle} onChange={(e) => setNewEventLieuSalle(e.target.value)} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label>Dossier (optionnel)</Label>
                    <Select value={newEventFolderId || "NONE"} onValueChange={(v) => setNewEventFolderId(v === "NONE" || !v ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Aucun dossier</SelectItem>
                        {folders.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Achat</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Date d&apos;achat</Label>
                  <Input type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Source</Label>
                  <Select value={source || "NONE"} onValueChange={(v) => setSource(v === "NONE" || !v ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      {sources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Quantité{seatCount > 1 ? " (ignorée - plage de places)" : ""}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    disabled={seatCount > 1}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Prix unitaire (coût)</Label>
                  <Input type="number" step="0.01" value={coutAchatUnit} onChange={(e) => setCoutAchatUnit(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Prix de revente cible (optionnel)</Label>
                  <Input type="number" step="0.01" value={prixCibleVente} onChange={(e) => setPrixCibleVente(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Numéro de commande</Label>
                  <Input value={numeroCommande} onChange={(e) => setNumeroCommande(e.target.value)} />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>Compte</Label>
                  <Input value={compteEmail} onChange={(e) => setCompteEmail(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Placement</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 flex flex-col gap-1.5">
                  <Label>Catégorie</Label>
                  <Input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ex : CAT 2 VR" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Section</Label>
                  <Input value={section} onChange={(e) => setSection(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Rang</Label>
                  <Input value={rang} onChange={(e) => setRang(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Place</Label>
                  <Input value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="Ex : 35-38" />
                </div>
              </div>
              {seatCount > 1 && (
                <p className="text-xs text-muted-foreground">
                  {seatCount} billets seront créés (places {parseSeatRange(seat)[0]} à{" "}
                  {parseSeatRange(seat)[seatCount - 1]}).
                </p>
              )}
            </section>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
              Créer {seatCount > 1 ? `(${seatCount} billets)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
