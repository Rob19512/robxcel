import { prisma } from "@/lib/prisma";
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";

export default async function CalendrierPage() {
  const events = await prisma.event.findMany({
    where: { dateEvenement: { not: null } },
    include: {
      category: true,
      stockItems: { where: { deletedAt: null, statut: { not: "VENDU" } } },
    },
    orderBy: { dateEvenement: "asc" },
  });

  const calendarEvents: CalendarEvent[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.dateEvenement!.toISOString().slice(0, 10),
    lieuSalle: e.lieuSalle,
    categoryName: e.category.name,
    categoryColor: e.category.color,
    remaining: e.stockItems.reduce((sum, s) => sum + s.qty, 0),
  }));

  return <CalendarView events={calendarEvents} />;
}
