"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnPrefs, type ColumnDef } from "@/lib/use-column-visibility";
import { useColumnSort, compareValues } from "@/lib/use-column-sort";
import { isEventPast } from "@/lib/event-utils";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, PackageCheck, CheckCircle2, Download, ChevronDown, ArrowUp, ArrowDown, Table2, LayoutGrid } from "lucide-react";
import { useTableViewMode } from "@/lib/use-table-view-mode";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkEncaissementButton } from "@/components/bulk-encaissement-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineText, InlineTextArea, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { CategoriePlacementField, parseCategoriePlacement } from "@/components/categorie-placement-field";
import { BulkAddStockDialog } from "@/components/bulk-add-stock-dialog";
import { CreateListingDialog } from "@/components/create-listing-dialog";
import { TablePagination } from "@/components/table-pagination";
import { eur, TVA_RATES } from "@/lib/format";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createStockItem,
  updateStockField,
  updateStockCustomValue,
  updateStockDate,
  updateStockEventId,
  deleteStockItem,
  restoreStockItem,
  bulkDeleteStockItems,
  bulkRestoreStockItems,
  bulkUpdateStockDates,
  duplicateStockItem,
  markStockVenduToday,
  markStockEncaisseToday,
  type StockCoreField,
} from "@/lib/actions/stock-actions";
import type { CategoryFieldDef, EventOption } from "@/components/sales-table";

export type StockRow = {
  id: string;
  dateAchat: string;
  description: string | null;
  source: string | null;
  eventId: string | null;
  qty: number;
  coutAchatUnit: number;
  prixCibleVente: number | null;
  priorite: "URGENT" | "NORMAL" | "PAS_PRESSE" | null;
  recu: boolean | null;
  tauxTvaAchat: number;
  dateVente: string | null;
  dateEncaissement: string | null;
  statut: "EN_STOCK" | "EN_ATTENTE" | "VENDU";
  compteEmail: string | null;
  notes: string | null;
  customValues: Record<string, string>;
};

const STATUT_LABEL: Record<StockRow["statut"], string> = {
  EN_STOCK: "📦 En stock",
  EN_ATTENTE: "⏳ En attente",
  VENDU: "✅ Vendu",
};

const statutBadgeVariant: Record<StockRow["statut"], string> = {
  EN_STOCK: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  VENDU: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const STATUT_LABEL_SHORT: Record<StockRow["statut"], string> = {
  EN_STOCK: "En stock",
  EN_ATTENTE: "En attente",
  VENDU: "Vendu",
};

const statutDotColor: Record<StockRow["statut"], string> = {
  EN_STOCK: "bg-zinc-400 dark:bg-zinc-500",
  EN_ATTENTE: "bg-amber-500",
  VENDU: "bg-emerald-500",
};

const PRIORITE_OPTIONS = [
  { value: "URGENT", label: "🔴 Urgent" },
  { value: "NORMAL", label: "🟡 Normal" },
  { value: "PAS_PRESSE", label: "🟢 Pas pressé" },
];
const PRIORITE_LABEL: Record<string, string> = Object.fromEntries(PRIORITE_OPTIONS.map((o) => [o.value, o.label]));

// Priorité calculée automatiquement pour les billets liés à un événement, à partir du
// nombre de jours restants avant le concert : plus besoin de la mettre à jour à la main.
function autoPrioriteFromDate(dateEvenement: string | null): "URGENT" | "NORMAL" | "PAS_PRESSE" | null {
  if (!dateEvenement) return null;
  const eventDate = new Date(`${dateEvenement}T00:00:00.000Z`);
  if (Number.isNaN(eventDate.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = Math.round((eventDate.getTime() - todayUtc) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 7) return "URGENT";
  if (daysUntil <= 21) return "NORMAL";
  return "PAS_PRESSE";
}

const RECU_OPTIONS = [
  { value: "true", label: "🟢 Reçu" },
  { value: "false", label: "🔴 Pas reçu" },
];

const tvaOptions = TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` }));

export function StockTable({
  categoryId,
  path,
  initialItems,
  fields,
  sources,
  trackPriorite,
  trackRecu,
  events,
  folders,
  hideAddButtons,
  showDescription = true,
  showCompteEmail = true,
}: {
  categoryId: string;
  path: string;
  initialItems: StockRow[];
  fields: CategoryFieldDef[];
  sources: string[];
  trackPriorite: boolean;
  trackRecu: boolean;
  events?: EventOption[];
  folders?: { id: string; name: string }[];
  hideAddButtons?: boolean;
  showDescription?: boolean;
  showCompteEmail?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [sortMode, setSortMode] = useState<"date" | "evenement">("evenement");
  const [viewMode, setViewMode] = useTableViewMode();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 50;
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const columnKeys = useMemo(
    () => [
      ...(showDescription ? ["description"] : []),
      "source",
      ...(events ? ["evenement"] : []),
      ...fields.map((f) => `custom:${f.key}`),
      "qty",
      "coutAchat",
      "prixCible",
      "marge",
      ...(trackPriorite ? ["priorite"] : []),
      ...(trackRecu ? ["recu"] : []),
      "tvaAchat",
      "tvaDed",
      "dateVente",
      "dateEncaissement",
      "statut",
      ...(showCompteEmail ? ["compteEmail"] : []),
    ],
    [showDescription, events, fields, trackPriorite, trackRecu, showCompteEmail]
  );
  const { order, isVisible, toggle: toggleColumn, move: moveColumn } = useColumnPrefs("stock", columnKeys);
  const { sort: columnSort, toggleSort } = useColumnSort();
  const columns: ColumnDef[] = useMemo(
    () => [
      ...(showDescription ? [{ key: "description", label: "Description" }] : []),
      { key: "source", label: "Source cible" },
      ...(events ? [{ key: "evenement", label: "Événement" }] : []),
      ...fields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
      { key: "qty", label: "Qté" },
      { key: "coutAchat", label: "Coût achat unit." },
      { key: "prixCible", label: "Prix cible vente" },
      { key: "marge", label: "Marge" },
      ...(trackPriorite ? [{ key: "priorite", label: "Priorité" }] : []),
      ...(trackRecu ? [{ key: "recu", label: "Reçu" }] : []),
      { key: "tvaAchat", label: "TVA achat" },
      { key: "tvaDed", label: "TVA déd." },
      { key: "dateVente", label: "Date de vente" },
      { key: "dateEncaissement", label: "Date encaissement" },
      { key: "statut", label: "Statut" },
      ...(showCompteEmail ? [{ key: "compteEmail", label: "Compte (email)" }] : []),
    ],
    [showDescription, events, fields, trackPriorite, trackRecu, showCompteEmail]
  );
  const visibleOrderedKeys = order.filter(isVisible);
  const labelByKey = useMemo(() => new Map(columns.map((c) => [c.key, c.label])), [columns]);
  function headClassName(key: string) {
    if (key.startsWith("custom:")) return "min-w-36";
    const widths: Record<string, string> = {
      description: "min-w-48",
      source: "min-w-36",
      evenement: "min-w-48",
      qty: "min-w-16",
      coutAchat: "min-w-28",
      prixCible: "min-w-28",
      marge: "min-w-28",
      priorite: "min-w-32",
      recu: "min-w-32",
      tvaAchat: "min-w-24",
      tvaDed: "min-w-24",
      dateVente: "min-w-32",
      dateEncaissement: "min-w-32",
      statut: "min-w-32",
      compteEmail: "min-w-40",
    };
    return widths[key] ?? "min-w-36";
  }

  function renderBodyCell(key: string, it: StockRow, margeCible: number | null, tvaDed: number) {
    if (key.startsWith("custom:")) {
      const fieldKey = key.slice("custom:".length);
      const f = fields.find((fd) => fd.key === fieldKey);
      if (!f) return null;
      if (fieldKey === "categoriePlacement") {
        return <CategoriePlacementField value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />;
      }
      return f.fieldType === "DATE" ? (
        <InlineDate value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
      ) : f.fieldType === "NUMBER" ? (
        <InlineNumber value={Number(it.customValues?.[f.key] ?? 0)} onSave={saveCustom(it.id, f.key)} />
      ) : (
        <InlineTextArea value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
      );
    }
    switch (key) {
      case "description":
        return (
          <InlineTextArea value={it.description ?? ""} onSave={saveField(it.id, "description")} testId="stock-description" />
        );
      case "source":
        return (
          <InlineSelect value={it.source ?? ""} options={sourceOptions} placeholder="Source" onSave={saveField(it.id, "source")} />
        );
      case "evenement":
        return (
          <InlineSelect value={it.eventId ?? ""} options={eventOptionsSorted()} placeholder="Événement" onSave={saveEvent(it.id)} />
        );
      case "qty":
        return <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />;
      case "coutAchat":
        return <InlineNumber value={it.coutAchatUnit} onSave={saveField(it.id, "coutAchatUnit")} />;
      case "prixCible":
        return <InlineNumber value={it.prixCibleVente ?? 0} onSave={saveField(it.id, "prixCibleVente")} />;
      case "marge":
        return margeCible !== null ? eur.format(margeCible) : "—";
      case "priorite": {
        const auto = it.eventId ? autoPrioriteFromDate(eventDateById.get(it.eventId) ?? null) : null;
        if (auto) {
          return (
            <span title="Calculée automatiquement selon la date de l'événement">{PRIORITE_LABEL[auto]}</span>
          );
        }
        return (
          <InlineSelect value={it.priorite ?? "NORMAL"} options={PRIORITE_OPTIONS} onSave={saveField(it.id, "priorite")} />
        );
      }
      case "recu":
        return (
          <InlineSelect value={String(it.recu ?? false)} options={RECU_OPTIONS} onSave={saveField(it.id, "recu")} />
        );
      case "tvaAchat":
        return (
          <InlineSelect value={String(it.tauxTvaAchat)} options={tvaOptions} onSave={saveField(it.id, "tauxTvaAchat")} />
        );
      case "tvaDed":
        return eur.format(tvaDed);
      case "dateVente":
        return (
          <div className="flex items-center gap-1">
            <InlineDate value={it.dateVente ?? ""} onSave={saveDate(it.id, "dateVente")} />
            {!it.dateVente && (
              <Button variant="ghost" size="icon-sm" title="Marquer vendu aujourd'hui" onClick={() => handleMarkVendu(it.id)}>
                <PackageCheck className="text-amber-600" />
              </Button>
            )}
          </div>
        );
      case "dateEncaissement":
        return (
          <div className="flex items-center gap-1">
            <InlineDate value={it.dateEncaissement ?? ""} onSave={saveDate(it.id, "dateEncaissement")} />
            {it.dateVente && !it.dateEncaissement && (
              <Button variant="ghost" size="icon-sm" title="Marquer encaissé aujourd'hui" onClick={() => handleMarkEncaisse(it.id)}>
                <CheckCircle2 className="text-emerald-600" />
              </Button>
            )}
          </div>
        );
      case "statut":
        return <Badge className={statutBadgeVariant[it.statut]}>{STATUT_LABEL[it.statut]}</Badge>;
      case "compteEmail":
        return <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />;
      default:
        return null;
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = initialItems;
  const sourceOptions = useMemo(() => sources.map((s) => ({ value: s, label: s })), [sources]);
  const eventLabelById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.label])), [events]);
  const eventDateById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.dateEvenement])), [events]);

  function sortValueFor(key: string, it: StockRow): string | number | null {
    if (key.startsWith("custom:")) {
      const fieldKey = key.slice("custom:".length);
      const f = fields.find((fd) => fd.key === fieldKey);
      const raw = it.customValues?.[fieldKey] ?? null;
      if (f?.fieldType === "NUMBER") return raw !== null ? Number(raw) : null;
      return raw;
    }
    switch (key) {
      case "dateAchat":
        return it.dateAchat;
      case "description":
        return it.description;
      case "source":
        return it.source;
      case "evenement":
        return it.eventId ? eventLabelById.get(it.eventId) ?? null : null;
      case "qty":
        return it.qty;
      case "coutAchat":
        return it.coutAchatUnit;
      case "prixCible":
        return it.prixCibleVente;
      case "marge":
        return it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
      case "priorite": {
        const auto = it.eventId ? autoPrioriteFromDate(eventDateById.get(it.eventId) ?? null) : null;
        return auto ?? it.priorite;
      }
      case "recu":
        return it.recu === null ? null : it.recu ? 1 : 0;
      case "tvaAchat":
        return it.tauxTvaAchat;
      case "tvaDed":
        return it.tauxTvaAchat > 0 ? it.qty * it.coutAchatUnit * (it.tauxTvaAchat / (100 + it.tauxTvaAchat)) : 0;
      case "dateVente":
        return it.dateVente;
      case "dateEncaissement":
        return it.dateEncaissement;
      case "statut":
        return it.statut;
      case "compteEmail":
        return it.compteEmail;
      default:
        return null;
    }
  }

  const filtered = useMemo(() => {
    const result = items.filter((it) => {
      if (!showSold && it.statut === "VENDU") return false;
      if (!search.trim()) return true;
      const haystack = normalizeForSearch(
        [
          it.description,
          it.source,
          it.notes,
          it.compteEmail,
          it.eventId ? eventLabelById.get(it.eventId) : null,
          String(it.qty),
          String(it.coutAchatUnit),
          it.prixCibleVente !== null ? String(it.prixCibleVente) : null,
          ...Object.values(it.customValues ?? {}),
        ]
          .join(" ")
      );
      return haystack.includes(normalizeForSearch(search));
    });

    if (columnSort) {
      const { key, dir } = columnSort;
      result.sort((a, b) => {
        const cmp = compareValues(sortValueFor(key, a), sortValueFor(key, b));
        return dir === "asc" ? cmp : -cmp;
      });
    } else if (events && sortMode === "evenement") {
      result.sort((a, b) => {
        const la = a.eventId ? eventLabelById.get(a.eventId) ?? "" : "";
        const lb = b.eventId ? eventLabelById.get(b.eventId) ?? "" : "";
        if (la !== lb) {
          if (!la) return 1; // sans événement à la fin
          if (!lb) return -1;
          return la.localeCompare(lb);
        }
        // Même événement : regrouper les billets d'une même commande (duo/quatuor)
        // pour qu'ils restent côte à côte au lieu d'être dispersés dans la liste.
        const ca = a.customValues?.numeroCommande?.trim() ?? "";
        const cb = b.customValues?.numeroCommande?.trim() ?? "";
        if (ca === cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb);
      });
    } else if (events && sortMode === "date") {
      // "Trier par date" pour les billets = la date du concert, pas la date d'achat :
      // c'est elle qui donne l'urgence réelle de vendre, pas quand le billet a été acheté.
      result.sort((a, b) => {
        const da = a.eventId ? eventDateById.get(a.eventId) ?? null : null;
        const db = b.eventId ? eventDateById.get(b.eventId) ?? null : null;
        if (da === db) return 0;
        if (!da) return 1; // sans événement à la fin
        if (!db) return -1;
        return da.localeCompare(db);
      });
    }

    // Les lignes tout juste ajoutées passent devant, quel que soit le tri : sinon une
    // ligne vide (sans événement) tombe en fin de liste et se retrouve sur la dernière
    // page, obligeant à naviguer jusqu'au bout pour la remplir.
    if (newIds.size > 0) {
      const fresh: typeof result = [];
      const rest: typeof result = [];
      for (const it of result) (newIds.has(it.id) ? fresh : rest).push(it);
      return [...fresh, ...rest];
    }
    return result;
  }, [items, showSold, search, eventLabelById, eventDateById, events, sortMode, newIds, columnSort, fields]);

  // Rendre 50 lignes à la fois au lieu de centaines d'un coup évite de monter
  // des centaines de champs éditables en même temps (lent).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);

  // Repart à la première page quand le filtre/tri change, pour ne pas rester
  // coincé au milieu d'un nouveau résultat de recherche.
  useEffect(() => {
    setPage(0);
  }, [search, showSold, sortMode]);
  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  // Vue carte : réunit dans une même carte les billets d'un même bloc de places (même
  // événement + même catégorie/rang, places différentes) plutôt qu'une carte par billet -
  // ex. "Cat 1, Rang 76, Places 1-4" en une seule carte au lieu de 4 cartes identiques.
  const hasPlacementGrouping = fields.some((f) => f.key === "categoriePlacement");
  const groupedForCards = useMemo(() => {
    type StockGroup = { key: string; eventId: string | null; categorie: string; rang: string; items: StockRow[] };
    if (!hasPlacementGrouping) {
      return filtered.map((it): StockGroup => ({ key: it.id, eventId: it.eventId, categorie: "", rang: "", items: [it] }));
    }
    const map = new Map<string, StockGroup>();
    const order: string[] = [];
    for (const it of filtered) {
      const parsed = parseCategoriePlacement(it.customValues?.categoriePlacement ?? "");
      const key = `${it.eventId ?? "none"}|${parsed.categorie.toLowerCase()}|${parsed.rang.toLowerCase()}`;
      let g = map.get(key);
      if (!g) {
        g = { key, eventId: it.eventId, categorie: parsed.categorie, rang: parsed.rang, items: [] };
        map.set(key, g);
        order.push(key);
      }
      g.items.push(it);
    }
    return order.map((k) => map.get(k)!);
  }, [filtered, hasPlacementGrouping]);
  const totalCardPages = Math.max(1, Math.ceil(groupedForCards.length / PAGE_SIZE));
  const currentCardPage = Math.min(page, totalCardPages - 1);
  const paginatedGroups = useMemo(
    () => groupedForCards.slice(currentCardPage * PAGE_SIZE, (currentCardPage + 1) * PAGE_SIZE),
    [groupedForCards, currentCardPage]
  );

  function handleAdd() {
    startTransition(async () => {
      try {
        const id = await createStockItem(categoryId, path);
        setNewIds((prev) => new Set(prev).add(id));
        setPage(0);
      } catch {
        toast.error("Impossible d'ajouter la ligne");
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
      prev.size === filtered.length ? new Set() : new Set(filtered.map((it) => it.id))
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkDeleteStockItems(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} article${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreStockItems(ids, path);
                toast.success("Restauré");
              });
            },
          },
        });
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function handleBulkEncaissement(dateVente: string | null, dateEncaissement: string | null) {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkUpdateStockDates(ids, path, dateVente, dateEncaissement);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} mise${ids.length > 1 ? "s" : ""} à jour`);
      } catch {
        toast.error("Impossible de mettre à jour l'encaissement");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteStockItem(id, path);
        toast.success("Article supprimé", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreStockItem(id, path);
                toast.success("Restauré");
              });
            },
          },
        });
      } catch {
        toast.error("Impossible de supprimer");
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateStockItem(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function handleMarkVendu(id: string) {
    startTransition(async () => {
      try {
        await markStockVenduToday(id, path);
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function handleMarkEncaisse(id: string) {
    startTransition(async () => {
      try {
        await markStockEncaisseToday(id, path);
        toast.success("Vente créée automatiquement");
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function saveField(id: string, field: StockCoreField) {
    return (value: string) => updateStockField(id, path, field, value);
  }

  function saveDate(id: string, field: "dateVente" | "dateEncaissement") {
    return (value: string) => updateStockDate(id, path, field, value || null);
  }

  function saveCustom(id: string, key: string) {
    return (value: string) => updateStockCustomValue(id, path, key, value);
  }

  function saveEvent(id: string) {
    return (value: string) => updateStockEventId(id, path, value || null);
  }

  // Les événements passés (date + 1 jour) ne sont plus proposés pour éviter de lier
  // un nouveau billet à un concert déjà terminé - mais un billet déjà lié à un
  // événement passé continue de l'afficher (juste retiré des NOUVEAUX choix).
  // Les événements à venir passent en premier (moins de défilement pour l'usage courant),
  // mais les événements passés restent dans la liste - pour pouvoir corriger un billet où
  // l'événement avait été oublié avant que la date ne passe.
  function eventOptionsSorted() {
    const upcoming = (events ?? []).filter((e) => !isEventPast(e.dateEvenement));
    const past = (events ?? []).filter((e) => isEventPast(e.dateEvenement));
    return [...upcoming, ...past].map((e) => ({ value: e.id, label: e.label }));
  }

  function handleExport() {
    downloadCsv(
      `stock-${path.replaceAll("/", "-").slice(1)}.csv`,
      filtered.map((it) => {
        const margeCible = it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : "";
        const row: Record<string, unknown> = { "Date achat": it.dateAchat };
        if (showDescription) row.Description = it.description ?? "";
        row["Source cible"] = it.source ?? "";
        for (const f of fields) row[f.label] = it.customValues?.[f.key] ?? "";
        Object.assign(row, {
          "Qté": it.qty,
          "Coût achat unit.": it.coutAchatUnit,
          "Prix cible vente": it.prixCibleVente ?? "",
          "Marge": margeCible,
          "Taux TVA achat": it.tauxTvaAchat,
          "Date de vente": it.dateVente ?? "",
          "Date encaissement": it.dateEncaissement ?? "",
          Statut: it.statut,
        });
        if (showCompteEmail) row["Compte (email)"] = it.compteEmail ?? "";
        row.Notes = it.notes ?? "";
        return row;
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!hideAddButtons && (
          <>
            <Button onClick={handleAdd} disabled={isPending} size="sm">
              <Plus />
              Ajouter en stock
            </Button>
            <BulkAddStockDialog
              categoryId={categoryId}
              path={path}
              fields={fields}
              trackPriorite={trackPriorite}
              trackRecu={trackRecu}
              events={events}
            />
            {events && (
              <CreateListingDialog
                categoryId={categoryId}
                path={path}
                events={events}
                folders={folders ?? []}
                fields={fields}
              />
            )}
          </>
        )}
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showSold} onCheckedChange={(v) => setShowSold(!!v)} />
          Afficher les vendus
        </label>
        {events && (
          <ToggleGroup
            value={[sortMode]}
            onValueChange={(v) => v[0] && setSortMode(v[0] as typeof sortMode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="date">Trier par date</ToggleGroupItem>
            <ToggleGroupItem value="evenement">Trier par événement</ToggleGroupItem>
          </ToggleGroup>
        )}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download />
          Exporter CSV
        </Button>
        <ColumnVisibilityMenu columns={columns} order={order} isVisible={isVisible} toggle={toggleColumn} move={moveColumn} />
        <BulkEncaissementButton count={selectedIds.size} onConfirm={handleBulkEncaissement} />
        <BulkDeleteButton count={selectedIds.size} onConfirm={handleBulkDelete} />
        <ToggleGroup
          value={[viewMode]}
          onValueChange={(v) => v[0] && setViewMode(v[0] as typeof viewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="table" title="Vue tableau">
            <Table2 />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" title="Vue carte">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} article{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Vue tableau (desktop) */}
      <Card className={cn("overflow-hidden py-0", viewMode === "cards" ? "hidden" : "hidden md:block")}>
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
                  className="min-w-32 cursor-pointer select-none"
                  stickyClassName={STICKY_COL}
                  onClick={() => toggleSort("dateAchat")}
                >
                  <span className="flex items-center gap-1">
                    Date achat
                    {columnSort?.key === "dateAchat" &&
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
              {paginated.map((it) => {
                const margeCible =
                  it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
                const tvaDed =
                  it.tauxTvaAchat > 0
                    ? it.qty * it.coutAchatUnit * (it.tauxTvaAchat / (100 + it.tauxTvaAchat))
                    : 0;
                return (
                  <TableRow key={it.id} data-state={selectedIds.has(it.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(it.id)} onCheckedChange={() => toggleSelected(it.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                    </StickyTableCell>
                    {visibleOrderedKeys.map((key) => (
                      <TableCell
                        key={key}
                        className={key === "marge" || key === "tvaDed" ? "text-center tabular-nums" : undefined}
                      >
                        {renderBodyCell(key, it, margeCible, tvaDed)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      17 +
                      fields.length +
                      (trackPriorite ? 1 : 0) +
                      (trackRecu ? 1 : 0) +
                      (events ? 1 : 0) +
                      (showDescription ? 1 : 0) +
                      (showCompteEmail ? 1 : 0)
                    }
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucun article en stock.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        <div className="border-t p-3">
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </Card>

      {/* Vue carte : réunit dans une même carte les billets d'un même bloc de places (même
          événement + même catégorie/rang) plutôt qu'une carte par billet. Repliée par défaut,
          forcée sur mobile, en grille compacte en mode carte explicite. */}
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3",
          viewMode === "cards" ? "sm:grid-cols-2 xl:grid-cols-3" : "md:hidden"
        )}
      >
        {paginatedGroups.map((group) => {
          const groupEventLabel = group.eventId ? eventLabelById.get(group.eventId) : null;
          const placementLabel = [group.categorie, group.rang ? `Rang ${group.rang}` : ""]
            .filter(Boolean)
            .join(" · ");
          const showGroupHeader = group.items.length > 1 || !!groupEventLabel || !!placementLabel;
          const soldCount = group.items.filter((it) => it.statut !== "EN_STOCK").length;
          const totalCible = group.items.reduce((sum, it) => sum + (it.prixCibleVente ?? 0) * it.qty, 0);

          return (
            <Card key={group.key} className="gap-0 overflow-hidden py-0">
              {showGroupHeader && (
                <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{groupEventLabel ?? "Sans événement"}</p>
                    {placementLabel && <p className="truncate text-xs text-muted-foreground">{placementLabel}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {group.items.length > 1 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "tabular-nums",
                          soldCount === group.items.length && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        )}
                      >
                        {soldCount}/{group.items.length}
                      </Badge>
                    )}
                    {totalCible > 0 && (
                      <span className="text-sm font-semibold tabular-nums">{eur.format(totalCible)}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="divide-y">
                {group.items.map((it) => {
                  const margeCible =
                    it.prixCibleVente !== null ? it.qty * (it.prixCibleVente - it.coutAchatUnit) : null;
                  const isOpen = expanded.has(it.id);
                  const effectivePriorite =
                    (it.eventId ? autoPrioriteFromDate(eventDateById.get(it.eventId) ?? null) : null) ?? it.priorite;
                  const isUrgent = trackPriorite && effectivePriorite === "URGENT";
                  const itemEventLabel = it.eventId ? eventLabelById.get(it.eventId) : null;
                  const seatPlace = showGroupHeader
                    ? parseCategoriePlacement(it.customValues?.categoriePlacement ?? "").place
                    : "";
                  const headerLabel = showGroupHeader
                    ? seatPlace
                      ? `Place ${seatPlace}`
                      : it.description || "Billet"
                    : it.description || itemEventLabel || "Sans description";
                  const headerSubLabel = showGroupHeader
                    ? null
                    : itemEventLabel && it.description
                      ? itemEventLabel
                      : null;

                  return (
                    <div key={it.id}>
                      <div className="flex w-full items-center gap-1 py-1 pr-1 pl-2">
                        <Checkbox
                          checked={selectedIds.has(it.id)}
                          onCheckedChange={() => toggleSelected(it.id)}
                          className="mr-1 shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpanded(it.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-muted/50"
                        >
                          <span
                            className={cn("size-2 shrink-0 rounded-full", statutDotColor[it.statut])}
                            title={STATUT_LABEL_SHORT[it.statut]}
                          />
                          {isUrgent && <span className="size-1.5 shrink-0 rounded-full bg-red-500" title="Urgent" />}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{headerLabel}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {STATUT_LABEL_SHORT[it.statut]}
                              {headerSubLabel ? ` · ${headerSubLabel}` : ""}
                            </span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                it.prixCibleVente === null && "text-muted-foreground/50"
                              )}
                            >
                              {it.prixCibleVente !== null ? eur.format(it.prixCibleVente) : "—"}
                            </span>
                            {margeCible !== null && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                +{eur.format(margeCible)}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                          />
                        </button>
                        <RowMenu onDuplicate={() => handleDuplicate(it.id)} onDelete={() => handleDelete(it.id)} />
                      </div>

                      {isOpen && (
                        <CardContent className="flex flex-col gap-3 border-t pt-3">
                          {showDescription && (
                            <InlineTextArea
                              value={it.description ?? ""}
                              placeholder="Description"
                              onSave={saveField(it.id, "description")}
                              className="text-base font-medium"
                            />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Date achat">
                              <InlineDate value={it.dateAchat} onSave={saveField(it.id, "dateAchat")} />
                            </Field>
                            <Field label="Source cible">
                              <InlineSelect
                                value={it.source ?? ""}
                                options={sourceOptions}
                                placeholder="Source"
                                onSave={saveField(it.id, "source")}
                              />
                            </Field>
                            {events && (
                              <Field label="Événement">
                                <InlineSelect
                                  value={it.eventId ?? ""}
                                  options={eventOptionsSorted()}
                                  placeholder="Événement"
                                  onSave={saveEvent(it.id)}
                                />
                              </Field>
                            )}
                            <Field label="Qté">
                              <InlineNumber value={it.qty} step="1" onSave={saveField(it.id, "qty")} />
                            </Field>
                            <Field label="Coût achat unit.">
                              <InlineNumber value={it.coutAchatUnit} onSave={saveField(it.id, "coutAchatUnit")} />
                            </Field>
                            <Field label="Prix cible vente">
                              <InlineNumber value={it.prixCibleVente ?? 0} onSave={saveField(it.id, "prixCibleVente")} />
                            </Field>
                            {fields.map((f) => (
                              <Field key={f.id} label={f.label}>
                                {f.key === "categoriePlacement" ? (
                                  <CategoriePlacementField value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                                ) : f.fieldType === "DATE" ? (
                                  <InlineDate value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                                ) : f.fieldType === "NUMBER" ? (
                                  <InlineNumber
                                    value={Number(it.customValues?.[f.key] ?? 0)}
                                    onSave={saveCustom(it.id, f.key)}
                                  />
                                ) : (
                                  <InlineTextArea value={it.customValues?.[f.key] ?? ""} onSave={saveCustom(it.id, f.key)} />
                                )}
                              </Field>
                            ))}
                            {trackPriorite && (
                              <Field label="Priorité">
                                {(() => {
                                  const auto = it.eventId ? autoPrioriteFromDate(eventDateById.get(it.eventId) ?? null) : null;
                                  return auto ? (
                                    <span title="Calculée automatiquement selon la date de l'événement">
                                      {PRIORITE_LABEL[auto]}
                                    </span>
                                  ) : (
                                    <InlineSelect
                                      value={it.priorite ?? "NORMAL"}
                                      options={PRIORITE_OPTIONS}
                                      onSave={saveField(it.id, "priorite")}
                                    />
                                  );
                                })()}
                              </Field>
                            )}
                            {trackRecu && (
                              <Field label="Reçu">
                                <InlineSelect
                                  value={String(it.recu ?? false)}
                                  options={RECU_OPTIONS}
                                  onSave={saveField(it.id, "recu")}
                                />
                              </Field>
                            )}
                            <Field label="TVA achat">
                              <InlineSelect
                                value={String(it.tauxTvaAchat)}
                                options={tvaOptions}
                                onSave={saveField(it.id, "tauxTvaAchat")}
                              />
                            </Field>
                            {showCompteEmail && (
                              <Field label="Compte (email)">
                                <InlineText value={it.compteEmail ?? ""} onSave={saveField(it.id, "compteEmail")} />
                              </Field>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-2">
                            <Field label="Date de vente">
                              <div className="flex items-center gap-1">
                                <InlineDate value={it.dateVente ?? ""} onSave={saveDate(it.id, "dateVente")} />
                                {!it.dateVente && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => handleMarkVendu(it.id)}>
                                    <PackageCheck className="text-amber-600" />
                                  </Button>
                                )}
                              </div>
                            </Field>
                            <Field label="Date encaissement">
                              <div className="flex items-center gap-1">
                                <InlineDate
                                  value={it.dateEncaissement ?? ""}
                                  onSave={saveDate(it.id, "dateEncaissement")}
                                />
                                {it.dateVente && !it.dateEncaissement && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => handleMarkEncaisse(it.id)}>
                                    <CheckCircle2 className="text-emerald-600" />
                                  </Button>
                                )}
                              </div>
                            </Field>
                          </div>
                        </CardContent>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {groupedForCards.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Aucun article en stock.</p>
        )}
        <TablePagination
          className="col-span-full"
          page={currentCardPage}
          totalPages={totalCardPages}
          total={groupedForCards.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
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

function RowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" data-testid="row-actions" />}>
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          Dupliquer
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
