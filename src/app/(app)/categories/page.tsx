import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { categoryRoute } from "@/lib/category-routes";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryCreateDialog } from "@/components/category-create-dialog";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground">
            Toutes tes sections, de base et personnalisées. Crée-en une nouvelle pour suivre autre chose
            (montres, cartes...).
          </p>
        </div>
        <CategoryCreateDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.id} href={categoryRoute(c.id)}>
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div
                  className="flex size-9 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${c.color ?? "#6366f1"}1a` }}
                >
                  {c.emoji}
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {c.name}
                    <Badge variant="secondary" className="text-[10px]">
                      {c.scope === "PRO" ? "Pro" : "Perso"}
                    </Badge>
                    {c.isBuiltin && (
                      <Badge variant="secondary" className="text-[10px]">
                        Base
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {c.kind === "BIEN" ? "Bien" : "Service"}
                    {c.hasStock ? " · avec stock" : ""}
                    {c.trackEvents ? " · événements" : ""}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
