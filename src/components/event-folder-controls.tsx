"use client";

import { useState } from "react";
import { FolderPlus, FolderX } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventFolderOption } from "@/components/events-table";

export function EventFolderControls({
  folders,
  activeFolderId,
  onFilterChange,
  onCreate,
  onDelete,
}: {
  folders: EventFolderOption[];
  activeFolderId: string | null;
  onFilterChange: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string>;
  onDelete: (folderId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsPending(true);
    try {
      const id = await onCreate(name);
      toast.success("Dossier créé");
      setOpen(false);
      setName("");
      onFilterChange(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de créer le dossier");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!activeFolderId) return;
    try {
      await onDelete(activeFolderId);
      toast.success("Dossier supprimé (les événements restent, juste dé-liés)");
      onFilterChange(null);
    } catch {
      toast.error("Impossible de supprimer le dossier");
    }
  }

  return (
    <>
      <Select
        value={activeFolderId ?? "ALL"}
        onValueChange={(v) => onFilterChange(v === "ALL" ? null : v)}
      >
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Tous les dossiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tous les dossiers</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderPlus />
        Nouveau dossier
      </Button>
      {activeFolderId && (
        <Button variant="outline" size="sm" onClick={handleDelete} title="Supprimer ce dossier">
          <FolderX />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
            <DialogDescription>
              Regroupe des événements ensemble (ex : "Coupe du monde") pour filtrer et voir le
              bénéfice cumulé en un clic.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Nom du dossier</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coupe du monde"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
