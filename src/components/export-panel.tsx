"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportScopeData } from "@/lib/actions/export-actions";
import { downloadCsv } from "@/lib/export-csv";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ExportPanel() {
  const [loading, setLoading] = useState<"PRO" | "PERSO" | null>(null);

  async function handleExport(scope: "PRO" | "PERSO") {
    setLoading(scope);
    try {
      const rows = await exportScopeData(scope);
      if (rows.length === 0) {
        toast.error("Aucune donnée à exporter pour cette catégorie");
        return;
      }
      downloadCsv(`robxcel-${scope.toLowerCase()}-${today()}.csv`, rows);
      toast.success(`Export ${scope} téléchargé (${rows.length} lignes)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export complet</CardTitle>
        <CardDescription>
          Un CSV par périmètre avec tout le Stock, les Ventes, les Événements, et les Achats
          pro / Charges perso — toutes catégories confondues (Billets, Prestations, Merch...).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => handleExport("PRO")} disabled={loading !== null}>
          <Download />
          {loading === "PRO" ? "Export en cours..." : "Exporter CSV Pro"}
        </Button>
        <Button variant="outline" onClick={() => handleExport("PERSO")} disabled={loading !== null}>
          <Download />
          {loading === "PERSO" ? "Export en cours..." : "Exporter CSV Perso"}
        </Button>
      </CardContent>
    </Card>
  );
}
