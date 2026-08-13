"use client";

import { useState } from "react";
import { Percent } from "lucide-react";
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

export function BulkTvaButton({
  count,
  tvaOptions,
  onConfirm,
}: {
  count: number;
  tvaOptions: { value: string; label: string }[];
  onConfirm: (tauxTvaVente: number | null, tauxTvaAchat: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tvaVente, setTvaVente] = useState("");
  const [tvaAchat, setTvaAchat] = useState("");

  if (count === 0) return null;

  const options = [{ value: "NONE", label: "— (ne pas modifier)" }, ...tvaOptions];
  const canSubmit = tvaVente !== "" || tvaAchat !== "";

  function handleApply() {
    onConfirm(tvaVente ? Number(tvaVente) : null, tvaAchat ? Number(tvaAchat) : null);
    setOpen(false);
    setTvaVente("");
    setTvaAchat("");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Percent />
        TVA ({count})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier la TVA de {count} vente{count > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Laisse un champ sur "—" pour ne pas toucher à ce taux-là. Les taux choisis sont
              appliqués à toutes les lignes sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>TVA vente</Label>
              <Select value={tvaVente || "NONE"} onValueChange={(v) => setTvaVente(v === "NONE" || !v ? "" : v)} items={options}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>TVA achat</Label>
              <Select value={tvaAchat || "NONE"} onValueChange={(v) => setTvaAchat(v === "NONE" || !v ? "" : v)} items={options}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button disabled={!canSubmit} onClick={handleApply}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
