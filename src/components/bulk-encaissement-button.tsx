"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function BulkEncaissementButton({
  count,
  onConfirm,
  showPrixCible = true,
}: {
  count: number;
  onConfirm: (prixCibleVente: number | null, dateVente: string | null, dateEncaissement: string | null) => void;
  /** Les lignes de Ventes représentent une transaction déjà réalisée à prix fixe - pas de
   * prix "cible" à poser avant encaissement, contrairement au Stock (pas encore vendu). */
  showPrixCible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prix, setPrix] = useState("");
  const [dateVente, setDateVente] = useState("");
  const [dateEncaissement, setDateEncaissement] = useState("");

  if (count === 0) return null;

  function handleConfirm() {
    onConfirm(showPrixCible && prix.trim() ? Number(prix) : null, dateVente || null, dateEncaissement || null);
    setOpen(false);
    setPrix("");
    setDateVente("");
    setDateEncaissement("");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wallet />
        Encaisser ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Encaissement en masse — {count} ligne{count > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Laisse un champ vide pour ne pas y toucher.
              {showPrixCible &&
                " Le prix de revente s'applique d'abord (il devient le prix de vente réel)."}{" "}
              Remplir la date de vente marque les lignes comme vendues ; remplir aussi la date
              d&apos;encaissement les marque payées (et les fait passer en Ventes si elles étaient
              encore en stock).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {showPrixCible && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-prix-cible">Prix de revente</Label>
                <Input
                  id="bulk-prix-cible"
                  type="number"
                  step="0.01"
                  value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-date-vente">Date de vente</Label>
              <Input
                id="bulk-date-vente"
                type="date"
                value={dateVente}
                onChange={(e) => setDateVente(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-date-encaissement">Date d&apos;encaissement</Label>
              <Input
                id="bulk-date-encaissement"
                type="date"
                value={dateEncaissement}
                onChange={(e) => setDateEncaissement(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleConfirm} disabled={!(showPrixCible && prix.trim()) && !dateVente && !dateEncaissement}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
