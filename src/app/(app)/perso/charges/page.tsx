import { prisma } from "@/lib/prisma";
import { serializeChargePerso } from "@/lib/serialize";
import { ChargesPersoTable } from "@/components/charges-perso-table";

export default async function ChargesPersoPage() {
  const items = await prisma.chargePerso.findMany({
    where: { deletedAt: null },
    orderBy: { date: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perso · Charges</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} ligne{items.length > 1 ? "s" : ""} · dépenses personnelles.
        </p>
      </div>
      <ChargesPersoTable path="/perso/charges" initialItems={items.map(serializeChargePerso)} />
    </div>
  );
}
