import { prisma } from "@/lib/prisma";
import { serializeSale, serializeStockItem } from "@/lib/serialize";
import { SalesTable } from "@/components/sales-table";
import { StockTable } from "@/components/stock-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORY_ID = "cat-billets";

export default async function BilletsPage() {
  const [category, sales, stockItems] = await Promise.all([
    prisma.category.findUniqueOrThrow({
      where: { id: CATEGORY_ID },
      include: { fields: { orderBy: { sortOrder: "asc" } }, sources: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.sale.findMany({
      where: { categoryId: CATEGORY_ID },
      orderBy: { dateVente: "desc" },
    }),
    prisma.stockItem.findMany({
      where: { categoryId: CATEGORY_ID },
      orderBy: { dateAchat: "desc" },
    }),
  ]);

  const stockFields = category.fields.filter((f) => f.showInStock);
  const saleFields = category.fields.filter((f) => f.showInSale);
  const stockSources = category.sources.filter((s) => s.appliesToStock).map((s) => s.label);
  const saleSources = category.sources.filter((s) => s.appliesToSale).map((s) => s.label);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billets</h1>
        <p className="text-sm text-muted-foreground">
          {sales.length} vente{sales.length > 1 ? "s" : ""} · {stockItems.length} en stock
        </p>
      </div>
      <Tabs defaultValue="ventes">
        <TabsList>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>
        <TabsContent value="ventes">
          <SalesTable
            categoryId={CATEGORY_ID}
            path="/billets"
            initialSales={sales.map(serializeSale)}
            fields={saleFields}
            sources={saleSources}
          />
        </TabsContent>
        <TabsContent value="stock">
          <StockTable
            categoryId={CATEGORY_ID}
            path="/billets"
            initialItems={stockItems.map(serializeStockItem)}
            fields={stockFields}
            sources={stockSources}
            trackPriorite={category.trackPriorite}
            trackRecu={category.trackRecu}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
