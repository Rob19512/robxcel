"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, X, Ticket, ClipboardPaste, Copy, Plus } from "lucide-react";
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
import { parseListingText } from "@/lib/actions/claude-import-actions";
import { createEventFolder } from "@/lib/actions/event-actions";
import type { EventOption } from "@/components/sales-table";

type FolderOption = { id: string; name: string };

// À copier-coller dans ChatGPT (ou autre) avec les données brutes de l'utilisateur (captures
// d'écran retranscrites, emails, etc.) pour qu'il les remette dans un format que le parseur
// Claude de "Coller un listing" comprend bien et de façon fiable.
const CHATGPT_FORMAT_PROMPT = `Tu vas recevoir des données de commandes de billets (texte, capture d'écran retranscrite, email...). Reformate-les selon EXACTEMENT ce modèle, un bloc par commande, séparés par une ligne de "=" :

==================================================

Compte
<email du compte utilisé pour cette commande>
Mot de passe <mot de passe du compte si connu>

Commande #<numéro> • <date de la commande JJ/MM/AAAA>

<Nom de l'événement>
<Date de l'événement JJ/MM/AAAA, heure si connue>
<Lieu / salle>

<Catégorie ou tier, ex: VIP Floor, Cat 1>
Section <code section si connu>
Rang <numéro si connu>
Sièges <premier>-<dernier> (ou un seul numéro, ou rien si places non numérotées)

<quantité> × <prix unitaire><devise d'origine si pas en euros, ex: 295,00 $>

==================================================

Règles :
- Une commande peut contenir plusieurs événements/billets différents : répète le bloc événement (à partir du nom de l'événement) autant de fois que nécessaire à l'intérieur du même bloc de commande.
- Si une info n'est pas connue, laisse-la vide ou omets la ligne - n'invente jamais une valeur.
- Garde les commandes séparées même si elles portent sur le même événement, ne fusionne jamais deux commandes ensemble.
- Réponds uniquement avec le texte reformaté, sans commentaire.

Voici les données à reformater :
[COLLE TES DONNÉES ICI]`;

function CopyPromptButton() {
  function handleCopy() {
    navigator.clipboard
      .writeText(CHATGPT_FORMAT_PROMPT)
      .then(() => toast.success("Prompt copié — colle-le dans ChatGPT avec tes données brutes"))
      .catch(() => toast.error("Impossible de copier le prompt"));
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      <Copy />
      Copier le prompt ChatGPT
    </Button>
  );
}

// Sélecteur "valeur connue / Autre (saisie libre)" réutilisé pour le site d'achat et le
// dossier événement - mêmes options que create-listing-dialog.tsx pour rester cohérent.
function PickOrCustom({
  label,
  value,
  onChange,
  options,
  placeholder,
  onCreate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  onCreate?: (value: string) => Promise<void>;
}) {
  const isCustom = value !== "" && !options.includes(value);
  const [mode, setMode] = useState<"pick" | "custom">(isCustom ? "custom" : "pick");
  const [customValue, setCustomValue] = useState(isCustom ? value : "");
  const [isCreating, setIsCreating] = useState(false);
  const alreadyExists = options.includes(customValue.trim());

  async function handleCreate() {
    if (!customValue.trim() || alreadyExists) return;
    setIsCreating(true);
    try {
      await onCreate!(customValue.trim());
      toast.success(`"${customValue.trim()}" créé`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de créer");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={mode === "custom" ? "CUSTOM" : value || "NONE"}
        onValueChange={(v) => {
          if (v === "CUSTOM") {
            setMode("custom");
            onChange(customValue);
          } else {
            setMode("pick");
            onChange(v === "NONE" || !v ? "" : v);
          }
        }}
        items={[
          { value: "NONE", label: "—" },
          { value: "CUSTOM", label: "Autre (saisie libre)" },
          ...options.map((o) => ({ value: o, label: o })),
        ]}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">—</SelectItem>
          <SelectItem value="CUSTOM">Autre (saisie libre)</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <div className="mt-1.5 flex gap-2">
          <Input
            placeholder={placeholder}
            value={customValue}
            onChange={(e) => {
              setCustomValue(e.target.value);
              onChange(e.target.value);
            }}
          />
          {onCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!customValue.trim() || alreadyExists || isCreating}
              onClick={handleCreate}
            >
              <Plus />
              Créer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Essaie de retrouver un événement déjà créé pour ne pas en recréer un doublon à chaque
// validation d'une commande séparée pour le même concert (nom + même jour).
function findMatchingEventId(listing: ImportedListingRow, events: EventOption[]): string | null {
  const name = listing.eventName.trim().toLowerCase();
  if (!name) return null;
  const listingDate = listing.eventDate ? listing.eventDate.slice(0, 10) : null;
  const match = events.find((e) => {
    const matchesName = e.label.toLowerCase().startsWith(name);
    const matchesDate = !listingDate || !e.dateEvenement || e.dateEvenement === listingDate;
    return matchesName && matchesDate;
  });
  return match?.id ?? null;
}

function ValidateImportDialog({
  listing,
  categoryId,
  path,
  events,
  ticketingSites,
  folders,
  onDone,
}: {
  listing: ImportedListingRow;
  categoryId: string;
  path: string;
  events: EventOption[];
  ticketingSites: string[];
  folders: FolderOption[];
  onDone: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const matchedEventId = findMatchingEventId(listing, events);
  const [eventMode, setEventMode] = useState<"existing" | "new">(matchedEventId ? "existing" : "new");
  const [selectedEventId, setSelectedEventId] = useState(matchedEventId ?? "");
  const [newEventName, setNewEventName] = useState(listing.eventName);
  const [newEventDate, setNewEventDate] = useState(listing.eventDate ? listing.eventDate.slice(0, 10) : "");
  const [newEventLieuSalle, setNewEventLieuSalle] = useState(listing.lieuSalle ?? "");
  const [newEventFolderName, setNewEventFolderName] = useState(listing.folderName ?? "");

  const [dateAchat, setDateAchat] = useState(listing.orderDate ? listing.orderDate.slice(0, 10) : today());
  const [coutAchatUnit, setCoutAchatUnit] = useState(String(listing.coutAchatUnit));
  const [prixCibleVente, setPrixCibleVente] = useState("");
  const [compte, setCompte] = useState(listing.recipientEmail ?? "");
  const [source, setSource] = useState(listing.source ?? "");

  const eventsSorted = [
    ...events.filter((e) => !isEventPast(e.dateEvenement)),
    ...events.filter((e) => isEventPast(e.dateEvenement)),
  ];

  async function handleValidate() {
    setIsPending(true);
    try {
      const { count } = await validateImportedListing(listing.id, categoryId, path, {
        eventId: eventMode === "existing" ? selectedEventId || null : null,
        newEventName: eventMode === "new" ? newEventName : "",
        newEventDate: eventMode === "new" ? newEventDate || null : null,
        newEventLieuSalle: eventMode === "new" ? newEventLieuSalle || null : null,
        newEventFolderName: eventMode === "new" ? newEventFolderName || null : null,
        dateAchat,
        coutAchatUnit: Number(coutAchatUnit) || 0,
        prixCibleVente: prixCibleVente.trim() ? Number(prixCibleVente) : null,
        compte,
        source,
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
                    {[s.section, s.rang ? `Rang ${s.rang}` : null, s.place ? `Place ${s.place}` : null]
                      .filter(Boolean)
                      .join(" - ")}
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Événement</h3>
              {matchedEventId && (
                <p className="text-xs text-muted-foreground">
                  Événement existant détecté automatiquement pour ce concert — change si ce n&apos;est pas le bon.
                </p>
              )}
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
                  <div className="col-span-2">
                    <PickOrCustom
                      label="Dossier événement (optionnel)"
                      value={newEventFolderName}
                      onChange={setNewEventFolderName}
                      options={folders.map((f) => f.name)}
                      placeholder="Ex : LA 2028"
                    />
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
                <div className="col-span-2">
                  <PickOrCustom
                    label="Site d'achat"
                    value={source}
                    onChange={setSource}
                    options={ticketingSites}
                    placeholder="Nom du site"
                  />
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

function PasteImportDialog({
  categoryId,
  path,
  ticketingSites,
  folders,
  onImported,
}: {
  categoryId: string;
  path: string;
  ticketingSites: string[];
  folders: FolderOption[];
  onImported: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [rawText, setRawText] = useState("");
  const [isEur, setIsEur] = useState(true);
  const [exchangeRate, setExchangeRate] = useState("");
  const [feePct, setFeePct] = useState("");
  const [defaultSource, setDefaultSource] = useState("");
  const [defaultFolderName, setDefaultFolderName] = useState("");
  const [localFolders, setLocalFolders] = useState(folders);

  async function handleCreateFolder(name: string) {
    await createEventFolder(categoryId, path, name);
    setLocalFolders((prev) => [...prev, { id: name, name }]);
    router.refresh();
  }

  async function handleSubmit() {
    setIsPending(true);
    try {
      const { created, total } = await parseListingText({
        rawText,
        isEur,
        exchangeRate: !isEur && exchangeRate.trim() ? Number(exchangeRate) : null,
        feePct: !isEur && feePct.trim() ? Number(feePct) : null,
        defaultSource: defaultSource || null,
        defaultFolderName: defaultFolderName || null,
      });
      toast.success(
        `${created} listing${created > 1 ? "s" : ""} détecté${created > 1 ? "s" : ""}` +
          (total > created ? ` (${total - created} ignoré${total - created > 1 ? "s" : ""})` : "") +
          " — à valider ci-dessous"
      );
      setOpen(false);
      setRawText("");
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'analyse du listing");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ClipboardPaste />
        Coller un listing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coller un listing</DialogTitle>
            <DialogDescription>
              Colle le texte (commandes, billets, prix...) — Claude l&apos;analyse et crée des listings à
              valider, comme pour l&apos;import Gmail.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Texte du listing</Label>
              <textarea
                className="min-h-40 w-full resize-y rounded-md border bg-transparent p-2.5 text-sm outline-none focus:border-ring"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Colle ici le texte des commandes..."
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Devise</h3>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={isEur ? "default" : "outline"} onClick={() => setIsEur(true)}>
                  Euros (€)
                </Button>
                <Button type="button" size="sm" variant={!isEur ? "default" : "outline"} onClick={() => setIsEur(false)}>
                  Autre devise
                </Button>
              </div>
              {!isEur && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>1 € = X (taux)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Ex : 1.1393"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Frais de change (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex : 0.6"
                      value={feePct}
                      onChange={(e) => setFeePct(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PickOrCustom
                label="Site d'achat par défaut (optionnel)"
                value={defaultSource}
                onChange={setDefaultSource}
                options={ticketingSites}
                placeholder="Nom du site"
              />
              <PickOrCustom
                label="Dossier événement (optionnel)"
                value={defaultFolderName}
                onChange={setDefaultFolderName}
                options={localFolders.map((f) => f.name)}
                placeholder="Ex : LA 2028"
                onCreate={handleCreateFolder}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleSubmit} disabled={!rawText.trim() || isPending}>
              {isPending ? "Analyse en cours..." : "Analyser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ImportedListingsPanel({
  categoryId,
  path,
  initialPending,
  events,
  ticketingSites,
  folders,
}: {
  categoryId: string;
  path: string;
  initialPending: ImportedListingRow[];
  events: EventOption[];
  ticketingSites: string[];
  folders: FolderOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [prevInitialPending, setPrevInitialPending] = useState(initialPending);
  const [isSyncing, startSync] = useTransition();

  // router.refresh() re-fetches server data et passe un nouveau tableau en prop, mais
  // useState(initialPending) n'est lu qu'au premier rendu : sans ce sync, la liste reste
  // figée tant que la page n'est pas rechargée manuellement. Ajustement pendant le rendu
  // (plutôt qu'un effect) suivant le pattern React recommandé pour l'état dérivé des props.
  if (initialPending !== prevInitialPending) {
    setPrevInitialPending(initialPending);
    setPending(initialPending);
  }

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

  // Un débit bancaire correspond à une commande entière, qui peut contenir plusieurs lignes
  // événement (ex: LA2028) - on regroupe par numéro de commande pour afficher un total retail
  // par commande, comparable directement à ce qui a été débité. Les listings sans numéro de
  // commande restent seuls (pas de fusion arbitraire entre eux).
  const groups: { key: string; numeroCommande: string | null; listings: ImportedListingRow[] }[] = [];
  const groupIndexByOrder = new Map<string, number>();
  for (const listing of pending) {
    if (listing.numeroCommande && groupIndexByOrder.has(listing.numeroCommande)) {
      groups[groupIndexByOrder.get(listing.numeroCommande)!].listings.push(listing);
    } else {
      if (listing.numeroCommande) groupIndexByOrder.set(listing.numeroCommande, groups.length);
      groups.push({ key: listing.id, numeroCommande: listing.numeroCommande, listings: [listing] });
    }
  }

  const grandTotal = pending.reduce((sum, l) => sum + l.qty * l.coutAchatUnit, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} listing{pending.length > 1 ? "s" : ""} en attente de validation
          {pending.length > 0 ? (
            <>
              {" · Total retail : "}
              <span className="font-medium text-foreground">{grandTotal.toFixed(2)} €</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <PasteImportDialog
            categoryId={categoryId}
            path={path}
            ticketingSites={ticketingSites}
            folders={folders}
            onImported={() => router.refresh()}
          />
          <CopyPromptButton />
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={isSyncing ? "animate-spin" : ""} />
            Synchroniser Gmail
          </Button>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Ticket className="size-6" />
          Aucun listing en attente. Clique sur &quot;Synchroniser Gmail&quot; pour vérifier les nouveaux mails.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const groupTotal = group.listings.reduce((sum, l) => sum + l.qty * l.coutAchatUnit, 0);
            return (
              <div key={group.key} className="flex flex-col gap-2">
                {group.numeroCommande && (
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="font-medium">Commande n°{group.numeroCommande}</span>
                    <span className="tabular-nums text-muted-foreground">
                      Total retail : <span className="font-medium text-foreground">{groupTotal.toFixed(2)} €</span>
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {group.listings.map((listing) => (
                    <div key={listing.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{listing.eventName}</span>
                          <Badge variant="outline">{listing.provider}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {listing.eventDate ? new Date(listing.eventDate).toLocaleString("fr-FR") : "Date inconnue"}
                          {listing.lieuSalle ? ` · ${listing.lieuSalle}` : ""}
                          {listing.categorie ? ` · Catégorie ${listing.categorie}` : ""}
                          {!group.numeroCommande && listing.numeroCommande ? ` · Commande n°${listing.numeroCommande}` : ""}
                          {listing.recipientEmail ? ` · ${listing.recipientEmail}` : ""}
                          {` · ${listing.qty} billet${listing.qty > 1 ? "s" : ""}`}
                          {` · ${listing.coutAchatUnit.toFixed(2)} €/billet`}
                          {` · total ${(listing.qty * listing.coutAchatUnit).toFixed(2)} €`}
                        </p>
                        <ul className="flex flex-col gap-0.5 text-sm">
                          {listing.seats.map((s, i) => (
                            <li key={i} className="text-muted-foreground">
                              {[s.section, s.rang ? `Rang ${s.rang}` : null, s.place ? `Place ${s.place}` : null, s.tag]
                                .filter(Boolean)
                                .join(" - ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <ValidateImportDialog
                          listing={listing}
                          categoryId={categoryId}
                          path={path}
                          events={events}
                          ticketingSites={ticketingSites}
                          folders={folders}
                          onDone={handleDone}
                        />
                        <Button size="sm" variant="outline" onClick={() => handleReject(listing.id)}>
                          <X />
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
