import { ExportPanel } from "@/components/export-panel";
import { listExportableCategories } from "@/lib/actions/export-actions";

export default async function ExportPage() {
  const [proCategories, persoCategories] = await Promise.all([
    listExportableCategories("PRO"),
    listExportableCategories("PERSO"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-muted-foreground">Télécharge toutes tes données en CSV.</p>
      </div>
      <ExportPanel proCategories={proCategories} persoCategories={persoCategories} />
    </div>
  );
}
