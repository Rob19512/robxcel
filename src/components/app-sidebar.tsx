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

const navMain = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, color: undefined },
  { href: "/billets", label: "Billets", icon: Ticket, color: "#6366f1" },
  { href: "/prestations", label: "Prestations", icon: Wrench, color: "#10b981" },
  { href: "/merch", label: "Sneakers / Merch", icon: ShoppingBag, color: "#f59e0b" },
];

const navPerso = [
  { href: "/perso/billets", label: "Billets", icon: Ticket, color: "#8b5cf6" },
  { href: "/perso/prestations", label: "Prestations", icon: Wrench, color: "#8b5cf6" },
  { href: "/perso/merch", label: "Merch", icon: ShoppingBag, color: "#8b5cf6" },
];

const navGestion: { href: string; label: string; icon: typeof Receipt; color?: string }[] = [
  { href: "/achats-pro", label: "Achats pro", icon: Receipt },
  { href: "/tva", label: "TVA trimestrielle", icon: Landmark },
  { href: "/aide", label: "Mode d'emploi", icon: BookOpen },
];

export function AppSidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Perso</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navPerso.map((item) => (
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
