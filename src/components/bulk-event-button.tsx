"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BulkEventButton({
  count,
  events,
  onConfirm,
}: {
  count: number;
  events: { value: string; label: string }[];
  onConfirm: (eventId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState("");

  if (count === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarRange />
        Événement ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier l&apos;événement de {count} ligne{count > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Le même événement sera associé à toutes les lignes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Événement</Label>
            <Select value={eventId} onValueChange={(v) => setEventId(v ?? "")} items={events}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              disabled={!eventId}
              onClick={() => {
                onConfirm(eventId);
                setOpen(false);
                setEventId("");
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
