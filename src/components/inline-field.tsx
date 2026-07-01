"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BaseProps = {
  onSave: (value: string) => Promise<void>;
  className?: string;
  placeholder?: string;
  testId?: string;
};

function useSavable(initial: string, onSave: BaseProps["onSave"]) {
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const save = (next: string) => {
    if (next === initial) return;
    setValue(next);
    startTransition(async () => {
      try {
        await onSave(next);
      } catch {
        toast.error("Erreur lors de l'enregistrement");
        setValue(initial);
      }
    });
  };

  return { value, setValue, save, isPending };
}

export function InlineText({
  value: initial,
  onSave,
  className,
  placeholder,
  testId,
}: BaseProps & { value: string }) {
  const { value, setValue, save, isPending } = useSavable(initial, onSave);
  return (
    <Input
      value={value}
      placeholder={placeholder}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => save(e.target.value)}
      data-testid={testId}
      className={cn("h-8 border-transparent bg-transparent hover:border-input focus:border-input", className)}
    />
  );
}

export function InlineNumber({
  value: initial,
  onSave,
  className,
  step = "0.01",
  testId,
}: BaseProps & { value: number; step?: string }) {
  const { value, setValue, save, isPending } = useSavable(String(initial), onSave);
  return (
    <Input
      type="number"
      step={step}
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => save(e.target.value)}
      data-testid={testId}
      className={cn(
        "h-8 border-transparent bg-transparent text-right tabular-nums hover:border-input focus:border-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  );
}

export function InlineDate({
  value: initial,
  onSave,
  className,
  testId,
}: BaseProps & { value: string }) {
  const { value, save, isPending } = useSavable(initial, onSave);
  return (
    <Input
      type="date"
      value={value}
      disabled={isPending}
      onChange={(e) => save(e.target.value)}
      data-testid={testId}
      className={cn("h-8 border-transparent bg-transparent hover:border-input focus:border-input", className)}
    />
  );
}

export function InlineSelect({
  value: initial,
  onSave,
  options,
  className,
  placeholder,
  testId,
}: BaseProps & { value: string; options: { value: string; label: string }[] }) {
  const { value, save, isPending } = useSavable(initial, onSave);
  return (
    <Select value={value} onValueChange={(v) => save(v ?? "")} disabled={isPending} items={options}>
      <SelectTrigger data-testid={testId} className={cn("h-8 border-transparent bg-transparent hover:border-input", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
