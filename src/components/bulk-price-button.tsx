"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
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

export function BulkPriceButton({
  count,
  onConfirm,
}: {
  count: number;
  onConfirm: (prixCibleVente: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prix, setPrix] = useState("");

  if (count === 0) return null;

  function handleConfirm() {
    onConfirm(Number(prix) || 0);
    setOpen(false);
    setPrix("");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Tag />
        Prix de revente ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Prix de revente en masse — {count} ligne{count > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Applique le même prix cible de revente à toutes les lignes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Label htmlFor="bulk-prix-cible">Prix de revente cible</Label>
            <Input
              id="bulk-prix-cible"
              type="number"
              step="0.01"
              autoFocus
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && prix.trim() && handleConfirm()}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleConfirm} disabled={!prix.trim()}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
