import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Home() {
  const session = await auth();
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold">Robxcel</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Se déconnecter
          </Button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="mb-6 text-sm text-muted-foreground">
          Connecté en tant que {session?.user?.email}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{c.emoji}</span>
                  {c.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {c.kind === "BIEN" ? "Bien (seuil 85 000 €)" : "Service (seuil 37 500 €)"}
                {c.hasStock ? " · avec stock" : " · sans stock"}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
