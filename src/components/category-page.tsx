import { prisma } from "@/lib/prisma";
import { serializeSale, serializeStockItem, serializeEvent } from "@/lib/serialize";
import { SalesTable } from "@/components/sales-table";
import { StockTable } from "@/components/stock-table";
import { EventsTable } from "@/components/events-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function CategoryPageContent({
  categoryId,
  path,
  title,
}: {
  categoryId: string;
  path: string;
  title: string;
}) {
  const category = await prisma.category.findUniqueOrThrow({
    where: { id: categoryId },
    include: { fields: { orderBy: { sortOrder: "asc" } }, sources: { orderBy: { sortOrder: "asc" } } },
  });

  const [sales, stockItems, events] = await Promise.all([
    prisma.sale.findMany({ where: { categoryId, deletedAt: null }, orderBy: { dateVente: "desc" } }),
    category.hasStock
      ? prisma.stockItem.findMany({ where: { categoryId, deletedAt: null }, orderBy: { dateAchat: "desc" } })
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
  const eventOptions = events.map((e) => ({
    id: e.id,
    label: [e.name, e.dateEvenement?.toLocaleDateString("fr-FR"), e.lieuSalle].filter(Boolean).join(" — "),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {sales.length} vente{sales.length > 1 ? "s" : ""}
          {category.hasStock ? ` · ${stockItems.length} en stock` : ""}
          {category.trackEvents ? ` · ${events.length} événement${events.length > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <Tabs defaultValue="ventes">
        <TabsList>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          {category.hasStock && <TabsTrigger value="stock">Stock</TabsTrigger>}
          {category.trackEvents && <TabsTrigger value="evenements">Événements</TabsTrigger>}
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
              initialItems={serializedStock}
              fields={stockFields}
              sources={stockSources}
              trackPriorite={category.trackPriorite}
              trackRecu={category.trackRecu}
              events={category.trackEvents ? eventOptions : undefined}
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
      </Tabs>
    </div>
  );
}
