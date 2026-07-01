import { prisma } from "@/lib/prisma";
import { serializeSale } from "@/lib/serialize";
import { SalesTable } from "@/components/sales-table";

const CATEGORY_ID = "cat-prestations";

export default async function PrestationsPage() {
  const [category, sales] = await Promise.all([
    prisma.category.findUniqueOrThrow({
      where: { id: CATEGORY_ID },
      include: { fields: { orderBy: { sortOrder: "asc" } }, sources: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.sale.findMany({
      where: { categoryId: CATEGORY_ID },
      orderBy: { dateVente: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prestations</h1>
        <p className="text-sm text-muted-foreground">
          {sales.length} ligne{sales.length > 1 ? "s" : ""}.
        </p>
      </div>
      <SalesTable
        categoryId={CATEGORY_ID}
        path="/prestations"
        initialSales={sales.map(serializeSale)}
        fields={category.fields.filter((f) => f.showInSale)}
        sources={category.sources.filter((s) => s.appliesToSale).map((s) => s.label)}
      />
    </div>
  );
}
