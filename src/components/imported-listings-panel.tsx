"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, X, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isEventPast } from "@/lib/event-utils";
import {
  syncTicketmasterImports,
  validateImportedListing,
  rejectImportedListing,
  type ImportedListingRow,
} from "@/lib/actions/import-actions";
import type { EventOption } from "@/components/sales-table";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ValidateImportDialog({
  listing,
  events,
  onDone,
}: {
  listing: ImportedListingRow;
  events: EventOption[];
  onDone: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [eventMode, setEventMode] = useState<"existing" | "new">("new");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [newEventName, setNewEventName] = useState(listing.eventName);
  const [newEventDate, setNewEventDate] = useState(listing.eventDate ? listing.eventDate.slice(0, 10) : "");
  const [newEventLieuSalle, setNewEventLieuSalle] = useState(listing.lieuSalle ?? "");

  const [dateAchat, setDateAchat] = useState(today());
  const [coutAchatUnit, setCoutAchatUnit] = useState(String(listing.coutAchatUnit));
  const [prixCibleVente, setPrixCibleVente] = useState("");
  const [compte, setCompte] = useState("");

  const eventsSorted = [
    ...events.filter((e) => !isEventPast(e.dateEvenement)),
    ...events.filter((e) => isEventPast(e.dateEvenement)),
  ];

  async function handleValidate() {
    setIsPending(true);
    try {
      const { count } = await validateImportedListing(listing.id, {
        eventId: eventMode === "existing" ? selectedEventId || null : null,
        newEventName: eventMode === "new" ? newEventName : "",
        newEventDate: eventMode === "new" ? newEventDate || null : null,
        newEventLieuSalle: eventMode === "new" ? newEventLieuSalle || null : null,
        dateAchat,
        coutAchatUnit: Number(coutAchatUnit) || 0,
        prixCibleVente: prixCibleVente.trim() ? Number(prixCibleVente) : null,
        compte,
      });
      toast.success(`${count} billet${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""} au stock`);
      setOpen(false);
      onDone(listing.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de valider ce listing");
    } finally {
      setIsPending(false);
    }
  }

  const canSubmit = (eventMode === "existing" ? !!selectedEventId : !!newEventName.trim()) && !!dateAchat;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Check />
        Valider
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Valider le listing importé</DialogTitle>
            <DialogDescription>
              Vérifie les informations détectées avant l&apos;ajout au stock ({listing.qty} billet
              {listing.qty > 1 ? "s" : ""}, commande n°{listing.numeroCommande ?? "?"}).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Places détectées</h3>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {listing.seats.map((s, i) => (
                  <li key={i}>
                    {[s.section, s.rang ? `Rang ${s.rang}` : null, s.place ? `Place ${s.place}` : null, s.tag]
                      .filter(Boolean)
                      .join(" - ")}
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Événement</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={eventMode === "new" ? "default" : "outline"}
                  onClick={() => setEventMode("new")}
                >
                  Nouvel événement
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={eventMode === "existing" ? "default" : "outline"}
                  onClick={() => setEventMode("existing")}
                >
                  Événement existant
                </Button>
              </div>

              {eventMode === "existing" ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Choisir l&apos;événement</Label>
                  <Select
                    value={selectedEventId}
                    onValueChange={(v) => setSelectedEventId(v ?? "")}
                    items={eventsSorted.map((e) => ({ value: e.id, label: e.label }))}
                  >
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
                    <Input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Date de l&apos;événement</Label>
                    <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Lieu / Salle</Label>
                    <Input value={newEventLieuSalle} onChange={(e) => setNewEventLieuSalle(e.target.value)} />
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
                  <Label>Prix unitaire (coût, par billet)</Label>
                  <Input type="number" step="0.01" value={coutAchatUnit} onChange={(e) => setCoutAchatUnit(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Prix de revente cible (optionnel)</Label>
                  <Input type="number" step="0.01" value={prixCibleVente} onChange={(e) => setPrixCibleVente(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Compte</Label>
                  <Input value={compte} onChange={(e) => setCompte(e.target.value)} />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleValidate} disabled={!canSubmit || isPending}>
              Ajouter au stock ({listing.qty})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ImportedListingsPanel({
  initialPending,
  events,
}: {
  initialPending: ImportedListingRow[];
  events: EventOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [isSyncing, startSync] = useTransition();

  function handleSync() {
    startSync(async () => {
      try {
        const result = await syncTicketmasterImports();
        toast.success(
          `${result.created} nouveau${result.created > 1 ? "x" : ""} listing${result.created > 1 ? "s" : ""} détecté${result.created > 1 ? "s" : ""}` +
            (result.skipped > 0 ? ` (${result.skipped} ignoré${result.skipped > 1 ? "s" : ""})` : "")
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec de la synchronisation Gmail");
      }
    });
  }

  async function handleReject(id: string) {
    try {
      await rejectImportedListing(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      toast.success("Listing ignoré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ignorer ce listing");
    }
  }

  function handleDone(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} listing{pending.length > 1 ? "s" : ""} en attente de validation
        </p>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={isSyncing ? "animate-spin" : ""} />
          Synchroniser Gmail
        </Button>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Ticket className="size-6" />
          Aucun listing en attente. Clique sur &quot;Synchroniser Gmail&quot; pour vérifier les nouveaux mails.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{listing.eventName}</span>
                  <Badge variant="outline">{listing.provider}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {listing.eventDate ? new Date(listing.eventDate).toLocaleString("fr-FR") : "Date inconnue"}
                  {listing.lieuSalle ? ` · ${listing.lieuSalle}` : ""}
                  {listing.categorie ? ` · Catégorie ${listing.categorie}` : ""}
                  {` · ${listing.qty} billet${listing.qty > 1 ? "s" : ""}`}
                  {` · ${listing.coutAchatUnit.toFixed(2)} €/billet`}
                </p>
              </div>
              <div className="flex gap-2">
                <ValidateImportDialog listing={listing} events={events} onDone={handleDone} />
                <Button size="sm" variant="outline" onClick={() => handleReject(listing.id)}>
                  <X />
                  Ignorer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
