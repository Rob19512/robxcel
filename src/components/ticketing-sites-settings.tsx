"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TVA_RATES } from "@/lib/format";
import {
  createTicketingSite,
  updateTicketingSiteRate,
  deleteTicketingSite,
} from "@/lib/actions/ticketing-site-actions";

export type TicketingSiteLite = { id: string; name: string; tauxTvaAchat: number | null };

const rateOptions = [
  { value: "", label: "—" },
  ...TVA_RATES.map((r) => ({ value: String(r), label: r === 0 ? "0 % (exo)" : `${r} %` })),
];

export function TicketingSitesSettings({ initialSites }: { initialSites: TicketingSiteLite[] }) {
  const [sites, setSites] = useState(initialSites);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createTicketingSite(name, newRate ? Number(newRate) : null);
        setSites((prev) => [...prev, { id: name, name, tauxTvaAchat: newRate ? Number(newRate) : null }]);
        setNewName("");
        setNewRate("");
        toast.success(`Site "${name}" ajouté`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Impossible d'ajouter ce site");
      }
    });
  }

  function handleSaveRate(id: string, value: string) {
    const rate = value === "" ? null : Number(value);
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, tauxTvaAchat: rate } : s)));
    startTransition(async () => {
      try {
        await updateTicketingSiteRate(id, rate);
      } catch {
        toast.error("Impossible d'enregistrer le taux");
      }
    });
  }

  function handleDelete(id: string) {
    setSites((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      try {
        await deleteTicketingSite(id);
      } catch {
        toast.error("Impossible de supprimer ce site");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sites d&apos;achat (billets)</CardTitle>
        <CardDescription>
          La TVA récupérable sur l&apos;achat d&apos;un billet dépend du site (chaque billetterie
          facture son propre taux) - renseigne-le une fois par site, il s&apos;appliquera
          automatiquement à chaque nouveau billet acheté sur ce site (à partir de la date
          d&apos;assujettissement ci-dessus).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sites.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
            <Select
              value={s.tauxTvaAchat === null ? "" : String(s.tauxTvaAchat)}
              onValueChange={(v) => handleSaveRate(s.id, v ?? "")}
              items={rateOptions}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rateOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(s.id)} disabled={isPending}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        ))}
        {sites.length === 0 && <p className="text-sm text-muted-foreground">Aucun site pour l&apos;instant.</p>}

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="new-site-name">Nouveau site</Label>
            <Input
              id="new-site-name"
              placeholder="Ex : Ticketmaster"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-32">
            <Label>TVA récupérable</Label>
            <Select value={newRate} onValueChange={(v) => setNewRate(v ?? "")} items={rateOptions}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rateOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={!newName.trim() || isPending} className="w-full sm:w-auto">
            <Plus />
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
