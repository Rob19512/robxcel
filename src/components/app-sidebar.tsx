"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Wrench,
  ShoppingBag,
  Receipt,
  Landmark,
  BookOpen,
  Wallet,
  CalendarDays,
  Layers,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { categoryRoute } from "@/lib/category-routes";

export type SidebarCategory = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  scope: "PRO" | "PERSO";
  isBuiltin: boolean;
};

const navMain = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, color: undefined },
  { href: "/a-encaisser", label: "À encaisser", icon: Wallet, color: "#059669" },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays, color: undefined },
];

const navGestion: { href: string; label: string; icon: typeof Receipt; color?: string }[] = [
  { href: "/categories", label: "Catégories", icon: Layers },
  { href: "/achats-pro", label: "Achats pro", icon: Receipt },
  { href: "/tva", label: "TVA trimestrielle", icon: Landmark },
  { href: "/aide", label: "Mode d'emploi", icon: BookOpen },
];

const BUILTIN_ICONS: Record<string, typeof Ticket> = {
  "cat-billets": Ticket,
  "cat-prestations": Wrench,
  "cat-merch": ShoppingBag,
  "cat-perso-billets": Ticket,
  "cat-perso-prestations": Wrench,
  "cat-perso-merch": ShoppingBag,
};

export function AppSidebar({
  userEmail,
  categories,
}: {
  userEmail?: string | null;
  categories: SidebarCategory[];
}) {
  const pathname = usePathname();
  const proCategories = categories.filter((c) => c.scope === "PRO");
  const persoCategories = categories.filter((c) => c.scope === "PERSO");

  function renderCategoryItem(c: SidebarCategory) {
    const href = categoryRoute(c.id);
    const Icon = BUILTIN_ICONS[c.id];
    return (
      <SidebarMenuItem key={c.id}>
        <SidebarMenuButton render={<Link href={href} />} isActive={pathname === href} tooltip={c.name}>
          {Icon ? <Icon color={c.color ?? undefined} /> : <span className="w-4 text-center">{c.emoji}</span>}
          <span>{c.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Robxcel
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Activité</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon color={item.color} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {proCategories.map(renderCategoryItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Perso</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{persoCategories.map(renderCategoryItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Gestion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navGestion.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon color={item.color} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1.5 text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
          {userEmail}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
