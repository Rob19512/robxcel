import { prisma } from "@/lib/prisma";
import { serializeSale, serializeStockItem, serializeEvent } from "@/lib/serialize";
import { SalesTable } from "@/components/sales-table";
import { StockTable } from "@/components/stock-table";
import { EventsTable } from "@/components/events-table";
import { CategorySettings } from "@/components/category-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function CategoryPageContent({
  categoryId,
  path,
  title,
}: {
  categoryId: string;
  path: string;
  title?: string;
}) {
  const category = await prisma.category.findUniqueOrThrow({
    where: { id: categoryId },
    include: { fields: { orderBy: { sortOrder: "asc" } }, sources: { orderBy: { sortOrder: "asc" } } },
  });

  // Quand la catégorie suit des événements (Billets), on regroupe les lignes par événement
  // — tous les tickets d'un même concert restent côte à côte, comme dans l'Excel d'origine —
  // plutôt que de tout éparpiller par simple date d'achat/vente.
  const saleOrderBy = category.trackEvents
    ? [{ event: { dateEvenement: "asc" as const } }, { dateVente: "desc" as const }]
    : { dateVente: "desc" as const };
  const stockOrderBy = category.trackEvents
    ? [{ event: { dateEvenement: "asc" as const } }, { dateAchat: "desc" as const }]
    : { dateAchat: "desc" as const };

  const [sales, stockItems, events] = await Promise.all([
    prisma.sale.findMany({ where: { categoryId, deletedAt: null }, orderBy: saleOrderBy }),
    category.hasStock
      ? prisma.stockItem.findMany({ where: { categoryId, deletedAt: null }, orderBy: stockOrderBy })
      : Promise.resolve([]),
    category.trackEvents
      ? prisma.event.findMany({ where: { categoryId }, orderBy: { dateEvenement: "desc" } })
      : Promise.resolve([]),
  ]);

  const stockFields = category.fields.filter((f) => f.showInStock);
  const saleFields = category.fields.filter((f) => f.showInSale);
  const stockSources = category.sources.filter((s) => s.appliesToStock).map((s) => s.label);
  const saleSources = category.sources.filter((s) => s.appliesToSale).map((s) => s.label);

  const serializedSales = sales.map(serializeSale);
  const serializedStock = stockItems.map(serializeStockItem);
  // Un article vendu (date de vente remplie) mais pas encore encaissé reste un StockItem
  // (statut EN_ATTENTE) tant que l'encaissement n'est pas saisi : on le sort du "Stock"
  // pur pour ne pas le confondre avec ce qui reste vraiment à vendre.
  const activeStock = serializedStock.filter((s) => s.statut !== "EN_ATTENTE");
  const pendingStock = serializedStock.filter((s) => s.statut === "EN_ATTENTE");
  const eventOptions = events.map((e) => ({
    id: e.id,
    label: [e.name, e.dateEvenement?.toLocaleDateString("fr-FR"), e.lieuSalle].filter(Boolean).join(" — "),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {category.emoji ? `${category.emoji} ` : ""}
          {title ?? category.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {sales.length} vente{sales.length > 1 ? "s" : ""}
          {category.hasStock
            ? ` · ${activeStock.length} en stock · ${pendingStock.length} en attente d'encaissement`
            : ""}
          {category.trackEvents ? ` · ${events.length} événement${events.length > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <Tabs defaultValue="ventes">
        <TabsList>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          {category.hasStock && <TabsTrigger value="stock">Stock</TabsTrigger>}
          {category.hasStock && (
            <TabsTrigger value="attente">
              En attente d&apos;encaissement
              {pendingStock.length > 0 ? ` (${pendingStock.length})` : ""}
            </TabsTrigger>
          )}
          {category.trackEvents && <TabsTrigger value="evenements">Événements</TabsTrigger>}
          {!category.isBuiltin && <TabsTrigger value="parametres">Paramètres</TabsTrigger>}
        </TabsList>
        <TabsContent value="ventes">
          <SalesTable
            categoryId={categoryId}
            path={path}
            initialSales={serializedSales}
            fields={saleFields}
            sources={saleSources}
            events={category.trackEvents ? eventOptions : undefined}
          />
        </TabsContent>
        {category.hasStock && (
          <TabsContent value="stock">
            <StockTable
              categoryId={categoryId}
              path={path}
              initialItems={activeStock}
              fields={stockFields}
              sources={stockSources}
              trackPriorite={category.trackPriorite}
              trackRecu={category.trackRecu}
              events={category.trackEvents ? eventOptions : undefined}
            />
          </TabsContent>
        )}
        {category.hasStock && (
          <TabsContent value="attente">
            <StockTable
              categoryId={categoryId}
              path={path}
              initialItems={pendingStock}
              fields={stockFields}
              sources={stockSources}
              trackPriorite={category.trackPriorite}
              trackRecu={category.trackRecu}
              events={category.trackEvents ? eventOptions : undefined}
              hideAddButtons
            />
          </TabsContent>
        )}
        {category.trackEvents && (
          <TabsContent value="evenements">
            <EventsTable
              categoryId={categoryId}
              path={path}
              initialEvents={events.map(serializeEvent)}
              stockItems={serializedStock}
              sales={serializedSales}
            />
          </TabsContent>
        )}
        {!category.isBuiltin && (
          <TabsContent value="parametres">
            <CategorySettings
              path={path}
              category={{
                id: category.id,
                name: category.name,
                emoji: category.emoji,
                color: category.color,
                kind: category.kind,
                scope: category.scope,
                hasStock: category.hasStock,
                trackPriorite: category.trackPriorite,
                trackRecu: category.trackRecu,
                trackEvents: category.trackEvents,
                fields: category.fields.map((f) => ({ id: f.id, label: f.label, fieldType: f.fieldType })),
                sources: category.sources.map((s) => ({ id: s.id, label: s.label })),
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
