"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory } from "@/lib/actions/category-actions";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#64748b",
];

export function CategoryCreateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState<"BIEN" | "SERVICE">("BIEN");
  const [scope, setScope] = useState<"PRO" | "PERSO">("PERSO");
  const [hasStock, setHasStock] = useState(true);
  const [trackPriorite, setTrackPriorite] = useState(false);
  const [trackRecu, setTrackRecu] = useState(false);
  const [trackEvents, setTrackEvents] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Donne un nom à la catégorie");
      return;
    }
    startTransition(async () => {
      try {
        const { route } = await createCategory({
          name,
          emoji,
          color,
          kind,
          scope,
          hasStock,
          trackPriorite,
          trackRecu,
          trackEvents,
        });
        setOpen(false);
        router.push(route);
      } catch {
        toast.error("Impossible de créer la catégorie");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        Nouvelle catégorie
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
            <DialogDescription>
              Elle apparaîtra dans le menu avec sa propre saisie, son stock et son suivi TVA.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Montres, Cartes à collectionner..."
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Emoji</Label>
                <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-20" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="size-6 rounded-full"
                      style={{
                        backgroundColor: c,
                        outline: color === c ? `2px solid ${c}` : undefined,
                        outlineOffset: 2,
                      }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => v && setKind(v as typeof kind)}
                  items={[
                    { value: "BIEN", label: "Bien (seuil 85 000 €)" },
                    { value: "SERVICE", label: "Service (seuil 37 500 €)" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIEN">Bien (seuil 85 000 €)</SelectItem>
                    <SelectItem value="SERVICE">Service (seuil 37 500 €)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Pro ou Perso</Label>
                <Select
                  value={scope}
                  onValueChange={(v) => v && setScope(v as typeof scope)}
                  items={[
                    { value: "PRO", label: "Pro" },
                    { value: "PERSO", label: "Perso" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="PERSO">Perso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasStock} onCheckedChange={(v) => setHasStock(!!v)} />
                Suivre un stock (achat avant vente)
              </label>
              {hasStock && (
                <>
                  <label className="ml-6 flex items-center gap-2 text-sm">
                    <Checkbox checked={trackPriorite} onCheckedChange={(v) => setTrackPriorite(!!v)} />
                    Suivre une priorité de vente
                  </label>
                  <label className="ml-6 flex items-center gap-2 text-sm">
                    <Checkbox checked={trackRecu} onCheckedChange={(v) => setTrackRecu(!!v)} />
                    Suivre si reçu
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={trackEvents} onCheckedChange={(v) => setTrackEvents(!!v)} />
                Rattacher à des événements (concerts...)
              </label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleCreate} disabled={isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
