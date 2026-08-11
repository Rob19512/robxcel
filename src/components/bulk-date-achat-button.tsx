"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
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

export function BulkDateAchatButton({
  count,
  onConfirm,
}: {
  count: number;
  onConfirm: (dateAchat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dateAchat, setDateAchat] = useState("");

  if (count === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock />
        Date d&apos;achat ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier la date d&apos;achat de {count} ligne{count > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              La même date sera appliquée à toutes les lignes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Date d&apos;achat</Label>
            <Input type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              disabled={!dateAchat}
              onClick={() => {
                onConfirm(dateAchat);
                setOpen(false);
                setDateAchat("");
              }}
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
