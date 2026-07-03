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
}: {
  count: number;
  onConfirm: (dateVente: string | null, dateEncaissement: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dateVente, setDateVente] = useState("");
  const [dateEncaissement, setDateEncaissement] = useState("");

  if (count === 0) return null;

  function handleConfirm() {
    onConfirm(dateVente || null, dateEncaissement || null);
    setOpen(false);
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
              Laisse un champ vide pour ne pas y toucher. Remplir la date de vente marque les
              lignes comme vendues ; remplir aussi la date d&apos;encaissement les marque payées
              (et les fait passer en Ventes si elles étaient encore en stock).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
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
            <Button onClick={handleConfirm} disabled={!dateVente && !dateEncaissement}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
