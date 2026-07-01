import { prisma } from "@/lib/prisma";
import { serializeAchatPro } from "@/lib/serialize";
import { AchatsProTable } from "@/components/achats-pro-table";

export default async function AchatsProPage() {
  const items = await prisma.achatPro.findMany({
    where: { deletedAt: null },
    orderBy: { dateAchat: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Achats pro</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} ligne{items.length > 1 ? "s" : ""} · charges et achats déductibles.
        </p>
      </div>
      <AchatsProTable path="/achats-pro" initialItems={items.map(serializeAchatPro)} />
    </div>
  );
}
