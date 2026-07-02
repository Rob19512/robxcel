"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function BulkDeleteButton({
  count,
  onConfirm,
  permanent,
}: {
  count: number;
  onConfirm: () => void;
  permanent?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 />
        Supprimer ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Supprimer {count} ligne{count > 1 ? "s" : ""} ?
            </DialogTitle>
            <DialogDescription>
              {permanent
                ? "Suppression définitive, pas d'annulation possible. Les billets/ventes liés ne sont pas supprimés, juste dé-liés."
                : "Tu pourras annuler juste après via le bouton « Annuler » qui s'affichera. Passé ce délai, les lignes restent récupérables — rien n'est perdu définitivement dans l'immédiat."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
