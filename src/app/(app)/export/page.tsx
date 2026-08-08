import { ExportPanel } from "@/components/export-panel";

export default function ExportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-sm text-muted-foreground">Télécharge toutes tes données en CSV.</p>
      </div>
      <ExportPanel />
    </div>
  );
}
