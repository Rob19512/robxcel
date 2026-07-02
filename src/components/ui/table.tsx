"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  className,
  containerRef,
  ...props
}: React.ComponentProps<"table"> & { containerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full border-separate border-spacing-0 caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

// Colonne figée à gauche : le sticky (position/left/z-index) doit rester sur le <th>/<td>
// lui-même — un enfant sticky reste borné par la boîte de son parent, donc le poser sur une
// div interne casse complètement l'effet de fixation. Par contre le FOND doit être répété
// sur une <div> interne en plus : les fonds de cellules de tableau ("table cell backgrounds")
// ont leur propre couche de peinture en CSS et ne masquent pas fiablement le contenu des
// cellules voisines qui défilent en dessous quand le fond est seulement sur la cellule.
function StickyTableHead({
  className,
  stickyClassName,
  children,
  ...props
}: React.ComponentProps<"th"> & { stickyClassName: string }) {
  return (
    <th data-slot="table-head" className={cn("p-0 whitespace-nowrap", stickyClassName, className)} {...props}>
      <div className="flex h-10 w-full items-center bg-inherit px-2 text-left align-middle font-medium text-foreground">
        {children}
      </div>
    </th>
  )
}

function StickyTableCell({
  className,
  stickyClassName,
  children,
  ...props
}: React.ComponentProps<"td"> & { stickyClassName: string }) {
  return (
    <td data-slot="table-cell" className={cn("p-0 whitespace-nowrap", stickyClassName, className)} {...props}>
      <div className="flex h-full w-full items-center bg-inherit p-2 align-middle">
        {children}
      </div>
    </td>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  StickyTableHead,
  StickyTableCell,
}
