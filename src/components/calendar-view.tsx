"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  name: string;
  date: string;
  lieuSalle: string | null;
  categoryName: string;
  categoryColor: string | null;
  remaining: number;
};

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const upcoming = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return events
      .filter((e) => toDate(e.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, now]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(year, month, 1 - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  function eventsOn(day: Date) {
    return events.filter((e) => sameDay(toDate(e.date), day));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground">
          Événements à venir et tickets restants — pour ne rien oublier.
        </p>
      </div>

      {/* Month grid — desktop only */}
      <Card className="hidden md:block">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
              Aujourd&apos;hui
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = sameDay(day, now);
              const dayEvents = eventsOn(day);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex min-h-20 flex-col gap-1 rounded-md border p-1 text-xs",
                    !inMonth && "opacity-40",
                    isToday && "border-primary"
                  )}
                >
                  <span className={cn("text-[11px] text-muted-foreground", isToday && "font-semibold text-primary")}>
                    {day.getDate()}
                  </span>
                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded px-1 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${e.categoryColor ?? "#6366f1"}1a`,
                        color: e.categoryColor ?? "#6366f1",
                      }}
                      title={`${e.name} — ${e.remaining} restant(s)`}
                    >
                      {e.name} · {e.remaining}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming list — all screens */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Événements à venir</h2>
        <div className="flex flex-col gap-2">
          {upcoming.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun événement à venir pour l&apos;instant.
              </CardContent>
            </Card>
          )}
          {upcoming.map((e) => {
            const daysLeft = Math.ceil((toDate(e.date).getTime() - now.getTime()) / 86400000);
            const urgent = daysLeft <= 7 && e.remaining > 0;
            return (
              <Card key={e.id} className={cn(urgent && "border-amber-400")}>
                <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        style={
                          e.categoryColor
                            ? { backgroundColor: `${e.categoryColor}1a`, color: e.categoryColor }
                            : undefined
                        }
                      >
                        {e.categoryName}
                      </Badge>
                      <span className="text-sm font-medium">{e.name}</span>
                      {e.lieuSalle && <span className="text-xs text-muted-foreground">{e.lieuSalle}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {toDate(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
                      {" · dans "}
                      {daysLeft} jour{daysLeft > 1 ? "s" : ""}
                    </span>
                  </div>
                  <Badge
                    className={
                      e.remaining > 0
                        ? urgent
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }
                  >
                    {e.remaining > 0 ? `${e.remaining} restant${e.remaining > 1 ? "s" : ""}` : "Tout vendu"}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
