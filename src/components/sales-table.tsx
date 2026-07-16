"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useHorizontalWheelScroll } from "@/lib/use-horizontal-wheel-scroll";
import { useColumnPrefs, type ColumnDef } from "@/lib/use-column-visibility";
import { useColumnSort, compareValues } from "@/lib/use-column-sort";
import { isEventPast } from "@/lib/event-utils";
import { ColumnVisibilityMenu } from "@/components/column-visibility-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Copy, Trash2, CheckCircle2, Download, ArrowUp, ArrowDown, Table2, LayoutGrid, ChevronDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTextArea, InlineNumber, InlineDate, InlineSelect } from "@/components/inline-field";
import { CategoriePlacementField, parseCategoriePlacement } from "@/components/categorie-placement-field";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkEncaissementButton } from "@/components/bulk-encaissement-button";
import { TablePagination } from "@/components/table-pagination";
import { eur, TVA_RATES } from "@/lib/format";
import { computeSale } from "@/lib/calc";
import { downloadCsv } from "@/lib/export-csv";
import { cn, STICKY_COL, normalizeForSearch } from "@/lib/utils";
import {
  createSale,
  updateSaleField,
  updateSaleCustomValue,
  updateSaleEventId,
  deleteSale,
  restoreSale,
  bulkDeleteSales,
  bulkRestoreSales,
  bulkUpdateSaleDates,
  duplicateSale,
  markSaleEncaisseToday,
  type SaleCoreField,
} from "@/lib/actions/sale-actions";

export type SaleRow = {
  id: string;
  dateVente: string;
  dateEncaissement: string | null;
  source: string | null;
  eventId: string | null;
  statut: "EN_ATTENTE" | "ENCAISSE" | "LITIGE";
  description: string | null;
  qty: number;
  prixVenteUnit: number;
  coutAchatUnit: number;
  tauxTvaVente: number;
  tauxTvaAchat: number;
  notes: string | null;
  customValues: Record<string, string>;
};

export type CategoryFieldDef = {
  id: string;
  key: string;
  label: string;
  fieldType: "TEXT" | "NUMBER" | "DATE";
};

const STATUT_OPTIONS = [
  { value: "ENCAISSE", label: "✅ Encaissé" },
  { value: "EN_ATTENTE", label: "⏳ En attente" },
  { value: "LITIGE", label: "⚠️ Litige" },
];

const statutBadgeVariant: Record<SaleRow["statut"], string> = {
  ENCAISSE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  LITIGE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const tvaOptions = TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` }));

export type EventOption = { id: string; label: string; dateEvenement: string | null };

export function SalesTable({
  categoryId,
  path,
  initialSales,
  fields,
  sources,
  events,
  showDescription = true,
}: {
  categoryId: string;
  path: string;
  initialSales: SaleRow[];
  fields: CategoryFieldDef[];
  sources: string[];
  events?: EventOption[];
  showDescription?: boolean;
}) {
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [sortMode, setSortMode] = useState<"date" | "evenement">("evenement");
  const [viewMode, setViewMode] = useTableViewMode();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const scrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const columnKeys = useMemo(
    () => [
      "dateEncaissement",
      "statut",
      "source",
      ...(events ? ["evenement"] : []),
      ...(showDescription ? ["description"] : []),
      ...fields.map((f) => `custom:${f.key}`),
      "qty",
      "prixVente",
      "coutAchat",
      "totalEncaisse",
      "margeBrute",
      "tvaVente",
      "tvaCollectee",
      "tvaAchat",
      "tvaDed",
      "beneficeApresTva",
    ],
    [events, showDescription, fields]
  );
  const { order, isVisible, toggle: toggleColumn, move: moveColumn } = useColumnPrefs("sales", columnKeys);
  const { sort: columnSort, toggleSort } = useColumnSort();
  const columns: ColumnDef[] = useMemo(
    () => [
      { key: "dateEncaissement", label: "Date encaissement" },
      { key: "statut", label: "Statut" },
      { key: "source", label: "Source" },
      ...(events ? [{ key: "evenement", label: "Événement" }] : []),
      ...(showDescription ? [{ key: "description", label: "Description" }] : []),
      ...fields.map((f) => ({ key: `custom:${f.key}`, label: f.label })),
      { key: "qty", label: "Qté" },
      { key: "prixVente", label: "Prix vente unit." },
      { key: "coutAchat", label: "Coût achat unit." },
      { key: "totalEncaisse", label: "Total encaissé" },
      { key: "margeBrute", label: "Marge brute" },
      { key: "tvaVente", label: "TVA vente" },
      { key: "tvaCollectee", label: "TVA collectée" },
      { key: "tvaAchat", label: "TVA achat" },
      { key: "tvaDed", label: "TVA déd." },
      { key: "beneficeApresTva", label: "Bénéf. après TVA" },
    ],
    [events, showDescription, fields]
  );
  const visibleOrderedKeys = order.filter(isVisible);
  const labelByKey = useMemo(() => new Map(columns.map((c) => [c.key, c.label])), [columns]);
  function headClassName(key: string) {
    if (key.startsWith("custom:")) return "min-w-36";
    const widths: Record<string, string> = {
      dateEncaissement: "min-w-32",
      statut: "min-w-36",
      source: "min-w-36",
      evenement: "min-w-48",
      description: "min-w-48",
      qty: "min-w-16",
      prixVente: "min-w-28",
      coutAchat: "min-w-28",
      totalEncaisse: "min-w-28",
      margeBrute: "min-w-28",
      tvaVente: "min-w-24",
      tvaCollectee: "min-w-24",
      tvaAchat: "min-w-24",
      tvaDed: "min-w-24",
      beneficeApresTva: "min-w-28",
    };
    return widths[key] ?? "min-w-36";
  }

  function renderBodyCell(key: string, s: SaleRow, calc: ReturnType<typeof computeSale>) {
    if (key.startsWith("custom:")) {
      const fieldKey = key.slice("custom:".length);
      const f = fields.find((fd) => fd.key === fieldKey);
      if (!f) return null;
      if (fieldKey === "categoriePlacement") {
        return <CategoriePlacementField value={s.customValues?.[f.key] ?? ""} onSave={saveCustom(s.id, f.key)} />;
      }
      return f.fieldType === "DATE" ? (
        <InlineDate value={s.customValues?.[f.key] ?? ""} onSave={saveCustom(s.id, f.key)} />
      ) : f.fieldType === "NUMBER" ? (
        <InlineNumber value={Number(s.customValues?.[f.key] ?? 0)} onSave={saveCustom(s.id, f.key)} />
      ) : (
        <InlineTextArea value={s.customValues?.[f.key] ?? ""} onSave={saveCustom(s.id, f.key)} />
      );
    }
    switch (key) {
      case "dateEncaissement":
        return (
          <div className="flex items-center gap-1">
            <InlineDate value={s.dateEncaissement ?? ""} onSave={saveField(s.id, "dateEncaissement")} />
            {!s.dateEncaissement && (
              <Button variant="ghost" size="icon-sm" title="Marquer encaissé aujourd'hui" onClick={() => handleMarkEncaisse(s.id)}>
                <CheckCircle2 className="text-emerald-600" />
              </Button>
            )}
          </div>
        );
      case "statut":
        return <InlineSelect value={s.statut} options={STATUT_OPTIONS} onSave={saveField(s.id, "statut")} />;
      case "source":
        return (
          <InlineSelect value={s.source ?? ""} options={sourceOptions} placeholder="Source" onSave={saveField(s.id, "source")} />
        );
      case "evenement":
        return (
          <InlineSelect value={s.eventId ?? ""} options={eventOptionsSorted()} placeholder="Événement" onSave={saveEvent(s.id)} />
        );
      case "description":
        return (
          <InlineTextArea value={s.description ?? ""} onSave={saveField(s.id, "description")} testId="sale-description" />
        );
      case "qty":
        return <InlineNumber value={s.qty} step="1" onSave={saveField(s.id, "qty")} />;
      case "prixVente":
        return <InlineNumber value={s.prixVenteUnit} onSave={saveField(s.id, "prixVenteUnit")} />;
      case "coutAchat":
        return <InlineNumber value={s.coutAchatUnit} onSave={saveField(s.id, "coutAchatUnit")} />;
      case "totalEncaisse":
        return eur.format(calc.totalEncaisse);
      case "margeBrute":
        return eur.format(calc.margeBrute);
      case "tvaVente":
        return <InlineSelect value={String(s.tauxTvaVente)} options={tvaOptions} onSave={saveField(s.id, "tauxTvaVente")} />;
      case "tvaCollectee":
        return eur.format(calc.tvaCollectee);
      case "tvaAchat":
        return <InlineSelect value={String(s.tauxTvaAchat)} options={tvaOptions} onSave={saveField(s.id, "tauxTvaAchat")} />;
      case "tvaDed":
        return eur.format(calc.tvaDeductibleAchat);
      case "beneficeApresTva":
        return eur.format(calc.beneficeNetApresTva);
      default:
        return null;
    }
  }

  useMemo(() => setSales(initialSales), [initialSales]);

  const eventLabelById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.label])), [events]);
  const eventDateById = useMemo(() => new Map((events ?? []).map((e) => [e.id, e.dateEvenement])), [events]);

  function sortValueFor(key: string, s: SaleRow): string | number | null {
    if (key.startsWith("custom:")) {
      const fieldKey = key.slice("custom:".length);
      const f = fields.find((fd) => fd.key === fieldKey);
      const raw = s.customValues?.[fieldKey] ?? null;
      if (f?.fieldType === "NUMBER") return raw !== null ? Number(raw) : null;
      return raw;
    }
    const calc = computeSale(s);
    switch (key) {
      case "dateVente":
        return s.dateVente;
      case "dateEncaissement":
        return s.dateEncaissement;
      case "statut":
        return s.statut;
      case "source":
        return s.source;
      case "evenement":
        return s.eventId ? eventLabelById.get(s.eventId) ?? null : null;
      case "description":
        return s.description;
      case "qty":
        return s.qty;
      case "prixVente":
        return s.prixVenteUnit;
      case "coutAchat":
        return s.coutAchatUnit;
      case "totalEncaisse":
        return calc.totalEncaisse;
      case "margeBrute":
        return calc.margeBrute;
      case "tvaVente":
        return s.tauxTvaVente;
      case "tvaCollectee":
        return calc.tvaCollectee;
      case "tvaAchat":
        return s.tauxTvaAchat;
      case "tvaDed":
        return calc.tvaDeductibleAchat;
      case "beneficeApresTva":
        return calc.beneficeNetApresTva;
      default:
        return null;
    }
  }

  const filtered = useMemo(() => {
    const result = sales.filter((s) => {
      if (statutFilter !== "ALL" && s.statut !== statutFilter) return false;
      if (!search.trim()) return true;
      const haystack = normalizeForSearch(
        [
          s.description,
          s.source,
          s.notes,
          s.eventId ? eventLabelById.get(s.eventId) : null,
          String(s.qty),
          String(s.prixVenteUnit),
          String(s.coutAchatUnit),
          ...Object.values(s.customValues ?? {}),
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
          if (!la) return 1;
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
      // "Trier par date" pour les billets = la date du concert, pas la date de vente :
      // c'est elle qui donne l'urgence réelle de vendre, pas quand le billet a été vendu.
      result.sort((a, b) => {
        const da = a.eventId ? eventDateById.get(a.eventId) ?? null : null;
        const db = b.eventId ? eventDateById.get(b.eventId) ?? null : null;
        if (da === db) return 0;
        if (!da) return 1;
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
      for (const s of result) (newIds.has(s.id) ? fresh : rest).push(s);
      return [...fresh, ...rest];
    }
    return result;
  }, [sales, statutFilter, search, eventLabelById, eventDateById, events, sortMode, newIds, columnSort, fields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  // Repart à la première page quand le filtre/tri change, pour ne pas rester
  // coincé au milieu d'un nouveau résultat de recherche.
  useEffect(() => {
    setPage(0);
  }, [search, statutFilter, sortMode]);

  // Vue carte : réunit dans une même carte les ventes d'un même bloc de places (même
  // événement + même catégorie/rang, places différentes) plutôt qu'une carte par vente.
  const hasPlacementGrouping = fields.some((f) => f.key === "categoriePlacement");
  const groupedForCards = useMemo(() => {
    type SaleGroup = { key: string; eventId: string | null; categorie: string; rang: string; items: SaleRow[] };
    if (!hasPlacementGrouping) {
      return filtered.map((s): SaleGroup => ({ key: s.id, eventId: s.eventId, categorie: "", rang: "", items: [s] }));
    }
    const map = new Map<string, SaleGroup>();
    const order: string[] = [];
    for (const s of filtered) {
      const parsed = parseCategoriePlacement(s.customValues?.categoriePlacement ?? "");
      const key = `${s.eventId ?? "none"}|${parsed.categorie.toLowerCase()}|${parsed.rang.toLowerCase()}`;
      let g = map.get(key);
      if (!g) {
        g = { key, eventId: s.eventId, categorie: parsed.categorie, rang: parsed.rang, items: [] };
        map.set(key, g);
        order.push(key);
      }
      g.items.push(s);
    }
    return order.map((k) => map.get(k)!);
  }, [filtered, hasPlacementGrouping]);
  const totalCardPages = Math.max(1, Math.ceil(groupedForCards.length / PAGE_SIZE));
  const currentCardPage = Math.min(page, totalCardPages - 1);
  const paginatedGroups = useMemo(
    () => groupedForCards.slice(currentCardPage * PAGE_SIZE, (currentCardPage + 1) * PAGE_SIZE),
    [groupedForCards, currentCardPage]
  );

  const sourceOptions = useMemo(() => sources.map((s) => ({ value: s, label: s })), [sources]);

  function handleAdd() {
    startTransition(async () => {
      try {
        const id = await createSale(categoryId, path);
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
      prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id))
    );
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkDeleteSales(ids, path);
        setSelectedIds(new Set());
        toast.success(`${ids.length} ligne${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}`, {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await bulkRestoreSales(ids, path);
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
        await bulkUpdateSaleDates(ids, path, dateVente, dateEncaissement);
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
        await deleteSale(id, path);
        toast.success("Ligne supprimée", {
          action: {
            label: "Annuler",
            onClick: () => {
              startTransition(async () => {
                await restoreSale(id, path);
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
        await duplicateSale(id, path);
        toast.success("Ligne dupliquée");
      } catch {
        toast.error("Impossible de dupliquer");
      }
    });
  }

  function handleMarkEncaisse(id: string) {
    startTransition(async () => {
      try {
        await markSaleEncaisseToday(id, path);
        toast.success("Marqué encaissé aujourd'hui");
      } catch {
        toast.error("Erreur");
      }
    });
  }

  function saveField(id: string, field: SaleCoreField) {
    return (value: string) => updateSaleField(id, path, field, value);
  }

  function handleExport() {
    downloadCsv(
      `ventes-${path.replaceAll("/", "-").slice(1)}.csv`,
      filtered.map((s) => {
        const calc = computeSale(s);
        const row: Record<string, unknown> = {
          "Date vente": s.dateVente,
          "Date encaissement": s.dateEncaissement ?? "",
          Statut: s.statut,
          Source: s.source ?? "",
        };
        if (showDescription) row.Description = s.description ?? "";
        for (const f of fields) row[f.label] = s.customValues?.[f.key] ?? "";
        Object.assign(row, {
          "Qté": s.qty,
          "Prix vente unit.": s.prixVenteUnit,
          "Coût achat unit.": s.coutAchatUnit,
          "Total encaissé": calc.totalEncaisse,
          "Marge brute": calc.margeBrute,
          "Taux TVA vente": s.tauxTvaVente,
          "TVA collectée": calc.tvaCollectee,
          "Taux TVA achat": s.tauxTvaAchat,
          "TVA déductible achat": calc.tvaDeductibleAchat,
          "Bénéf. net après TVA": calc.beneficeNetApresTva,
          Notes: s.notes ?? "",
        });
        return row;
      })
    );
  }

  function saveCustom(id: string, key: string) {
    return (value: string) => updateSaleCustomValue(id, path, key, value);
  }

  function saveEvent(id: string) {
    return (value: string) => updateSaleEventId(id, path, value || null);
  }

  // Les événements à venir passent en premier (moins de défilement pour l'usage courant),
  // mais les événements passés restent dans la liste - pour pouvoir corriger une vente où
  // l'événement avait été oublié avant que la date ne passe.
  function eventOptionsSorted() {
    const upcoming = (events ?? []).filter((e) => !isEventPast(e.dateEvenement));
    const past = (events ?? []).filter((e) => isEventPast(e.dateEvenement));
    return [...upcoming, ...past].map((e) => ({ value: e.id, label: e.label }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAdd} disabled={isPending} size="sm">
          <Plus />
          Ajouter une vente
        </Button>
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <Select
          value={statutFilter}
          onValueChange={(v) => setStatutFilter(v ?? "ALL")}
          items={[{ value: "ALL", label: "Tous les statuts" }, ...STATUT_OPTIONS]}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {STATUT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          {filtered.length} ligne{filtered.length > 1 ? "s" : ""}
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
                  onClick={() => toggleSort("dateVente")}
                >
                  <span className="flex items-center gap-1">
                    Date vente
                    {columnSort?.key === "dateVente" &&
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
              {paginated.map((s) => {
                const calc = computeSale(s);
                return (
                  <TableRow key={s.id} data-state={selectedIds.has(s.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                    </TableCell>
                    <StickyTableCell stickyClassName={STICKY_COL}>
                      <InlineDate value={s.dateVente} onSave={saveField(s.id, "dateVente")} />
                    </StickyTableCell>
                    {visibleOrderedKeys.map((key) => (
                      <TableCell
                        key={key}
                        className={
                          ["totalEncaisse", "margeBrute", "tvaCollectee", "tvaDed", "beneficeApresTva"].includes(key)
                            ? cn(
                                "text-center tabular-nums",
                                (key === "totalEncaisse" || key === "beneficeApresTva") && "font-medium"
                              )
                            : undefined
                        }
                      >
                        {renderBodyCell(key, s, calc)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <RowMenu
                        onDuplicate={() => handleDuplicate(s.id)}
                        onDelete={() => handleDelete(s.id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={17 + fields.length + (events ? 1 : 0) + (showDescription ? 1 : 0)}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucune vente pour l&apos;instant.
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

      {/* Vue carte : réunit dans une même carte les ventes d'un même bloc de places (même
          événement + même catégorie/rang) plutôt qu'une carte par vente. Forcée sur mobile,
          en grille compacte en mode carte explicite. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          viewMode === "cards" ? "sm:grid-cols-2 xl:grid-cols-3" : "md:hidden"
        )}
      >
        {paginatedGroups.map((group) => {
          const groupEventLabel = group.eventId ? eventLabelById.get(group.eventId) : null;
          const placementLabel = [group.categorie, group.rang ? `Rang ${group.rang}` : ""]
            .filter(Boolean)
            .join(" · ");
          const showGroupHeader = group.items.length > 1 || !!groupEventLabel || !!placementLabel;
          const totalEncaisseGroup = group.items.reduce((sum, s) => sum + computeSale(s).totalEncaisse, 0);
          const encaisseCount = group.items.filter((s) => s.statut === "ENCAISSE").length;

          return (
            <Card key={group.key} className="overflow-hidden py-0">
              {showGroupHeader && (
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{groupEventLabel ?? "Sans événement"}</p>
                    {placementLabel && <p className="truncate text-xs text-muted-foreground">{placementLabel}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {group.items.length > 1 && (
                      <Badge variant="secondary" className="tabular-nums">
                        {encaisseCount}/{group.items.length}
                      </Badge>
                    )}
                    <span className="text-sm font-semibold tabular-nums">{eur.format(totalEncaisseGroup)}</span>
                  </div>
                </div>
              )}
              <div className="divide-y">
                {group.items.map((s) => {
                  const calc = computeSale(s);
                  const isOpen = expanded.has(s.id);
                  const seatPlace = showGroupHeader
                    ? parseCategoriePlacement(s.customValues?.categoriePlacement ?? "").place
                    : "";
                  const itemEventLabel = s.eventId ? eventLabelById.get(s.eventId) : null;
                  const headerLabel = showGroupHeader
                    ? seatPlace
                      ? `Place ${seatPlace}`
                      : s.description || "Vente"
                    : s.description || itemEventLabel || "Sans description";

                  return (
                    <div key={s.id}>
                      <div className="flex w-full items-center gap-1 p-3">
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelected(s.id)}
                          className="mr-1 shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpanded(s.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{headerLabel}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {STATUT_OPTIONS.find((o) => o.value === s.statut)?.label}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {eur.format(calc.totalEncaisse)}
                          </span>
                          <ChevronDown
                            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                          />
                        </button>
                      </div>

                      {isOpen && (
                        <CardContent className="flex flex-col gap-3 border-t pt-3">
                          <div className="flex items-center justify-between">
                            <Badge className={statutBadgeVariant[s.statut]}>
                              {STATUT_OPTIONS.find((o) => o.value === s.statut)?.label}
                            </Badge>
                            <RowMenu
                              onDuplicate={() => handleDuplicate(s.id)}
                              onDelete={() => handleDelete(s.id)}
                            />
                          </div>
                          {showDescription && (
                            <InlineTextArea
                              value={s.description ?? ""}
                              placeholder="Description"
                              onSave={saveField(s.id, "description")}
                              className="text-base font-medium"
                            />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Date vente">
                              <InlineDate value={s.dateVente} onSave={saveField(s.id, "dateVente")} />
                            </Field>
                            <Field label="Date encaissement">
                              <div className="flex items-center gap-1">
                                <InlineDate
                                  value={s.dateEncaissement ?? ""}
                                  onSave={saveField(s.id, "dateEncaissement")}
                                />
                                {!s.dateEncaissement && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleMarkEncaisse(s.id)}
                                  >
                                    <CheckCircle2 className="text-emerald-600" />
                                  </Button>
                                )}
                              </div>
                            </Field>
                            <Field label="Source">
                              <InlineSelect
                                value={s.source ?? ""}
                                options={sourceOptions}
                                placeholder="Source"
                                onSave={saveField(s.id, "source")}
                              />
                            </Field>
                            {events && (
                              <Field label="Événement">
                                <InlineSelect
                                  value={s.eventId ?? ""}
                                  options={eventOptionsSorted()}
                                  placeholder="Événement"
                                  onSave={saveEvent(s.id)}
                                />
                              </Field>
                            )}
                            <Field label="Qté">
                              <InlineNumber value={s.qty} step="1" onSave={saveField(s.id, "qty")} />
                            </Field>
                            <Field label="Prix vente unit.">
                              <InlineNumber value={s.prixVenteUnit} onSave={saveField(s.id, "prixVenteUnit")} />
                            </Field>
                            <Field label="Coût achat unit.">
                              <InlineNumber value={s.coutAchatUnit} onSave={saveField(s.id, "coutAchatUnit")} />
                            </Field>
                            {fields.map((f) => (
                              <Field key={f.id} label={f.label}>
                                {f.key === "categoriePlacement" ? (
                                  <CategoriePlacementField
                                    value={s.customValues?.[f.key] ?? ""}
                                    onSave={saveCustom(s.id, f.key)}
                                  />
                                ) : f.fieldType === "DATE" ? (
                                  <InlineDate
                                    value={s.customValues?.[f.key] ?? ""}
                                    onSave={saveCustom(s.id, f.key)}
                                  />
                                ) : f.fieldType === "NUMBER" ? (
                                  <InlineNumber
                                    value={Number(s.customValues?.[f.key] ?? 0)}
                                    onSave={saveCustom(s.id, f.key)}
                                  />
                                ) : (
                                  <InlineTextArea
                                    value={s.customValues?.[f.key] ?? ""}
                                    onSave={saveCustom(s.id, f.key)}
                                  />
                                )}
                              </Field>
                            ))}
                            <Field label="TVA vente">
                              <InlineSelect
                                value={String(s.tauxTvaVente)}
                                options={tvaOptions}
                                onSave={saveField(s.id, "tauxTvaVente")}
                              />
                            </Field>
                            <Field label="TVA achat">
                              <InlineSelect
                                value={String(s.tauxTvaAchat)}
                                options={tvaOptions}
                                onSave={saveField(s.id, "tauxTvaAchat")}
                              />
                            </Field>
                          </div>
                          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Bénéf. net après TVA</span>
                            <span className="font-semibold tabular-nums">
                              {eur.format(calc.beneficeNetApresTva)}
                            </span>
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
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Aucune vente pour l&apos;instant.
          </p>
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
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" data-testid="row-actions" />}
      >
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
