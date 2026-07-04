import { auth, signOut } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { TvaAlertBanner } from "@/components/tva-alert-banner";
import { InstallPrompt } from "@/components/install-prompt";
import { LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getTvaAlerts } from "@/lib/tva-alert";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, categories, tvaAlerts] = await Promise.all([
    auth(),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, emoji: true, color: true, scope: true, isBuiltin: true },
    }),
    getTvaAlerts(),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar userEmail={session?.user?.email} categories={categories} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex-1 text-sm text-muted-foreground">
            {session?.user?.email}
          </div>
          <ThemeToggle />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Se déconnecter
            </Button>
          </form>
        </header>
        <TvaAlertBanner alerts={tvaAlerts} />
        {/* pb-24 : réserve de la place pour la bannière d'installation PWA (fixed, bottom-4),
            qui sinon recouvre la dernière carte visible sur mobile en scrollant tout en bas. */}
        <main className="flex flex-1 flex-col gap-6 bg-background p-4 pb-24 sm:p-6">
          {children}
        </main>
        <InstallPrompt />
      </SidebarInset>
    </SidebarProvider>
  );
}
