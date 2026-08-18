"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportScopeData, exportCategoryData, type ExportableCategory } from "@/lib/actions/export-actions";
import { exportBilletsTemplate } from "@/lib/actions/billets-template-export";
import { downloadCsv } from "@/lib/export-csv";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ExportPanel({
  proCategories,
  persoCategories,
}: {
  proCategories: ExportableCategory[];
  persoCategories: ExportableCategory[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function handleScopeExport(scope: "PRO" | "PERSO") {
    setLoadingKey(scope);
    try {
      const rows = await exportScopeData(scope);
      if (rows.length === 0) {
        toast.error("Aucune donnée à exporter pour ce périmètre");
        return;
      }
      downloadCsv(`robxcel-${scope.toLowerCase()}-${today()}.csv`, rows);
      toast.success(`Export ${scope} téléchargé (${rows.length} lignes)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export");
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleCategoryExport(category: ExportableCategory) {
    setLoadingKey(category.id);
    try {
      const rows = await exportCategoryData(category.id);
      if (rows.length === 0) {
        toast.error(`Aucune donnée à exporter pour ${category.name}`);
        return;
      }
      downloadCsv(`robxcel-${slugify(category.name)}-${today()}.csv`, rows);
      toast.success(`Export ${category.name} téléchargé (${rows.length} lignes)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export");
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleBilletsTemplateExport(category: ExportableCategory) {
    const key = `template-${category.id}`;
    setLoadingKey(key);
    try {
      const rows = await exportBilletsTemplate(category.id);
      if (rows.length === 0) {
        toast.error(`Aucune donnée à exporter pour ${category.name}`);
        return;
      }
      // Virgule (standard CSV) et pas point-virgule : ce fichier est fait pour être
      // ré-importé dans un autre logiciel, pas ouvert par toi dans Excel.
      downloadCsv(`robxcel-${slugify(category.name)}-template-${today()}.csv`, rows, ",");
      toast.success(`Export ${category.name} (template) téléchargé (${rows.length} lignes)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export");
    } finally {
      setLoadingKey(null);
    }
  }

  // Le template (section/row/seats, account_email/password...) n'a de sens que pour les
  // billets - retrouvé par nom plutôt qu'un id en dur, pour rester correct si la catégorie
  // est un jour recréée avec un autre id.
  const proBillets = proCategories.find((c) => c.name.toLowerCase().includes("billet"));
  const persoBillets = persoCategories.find((c) => c.name.toLowerCase().includes("billet"));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Billets (format template)</CardTitle>
          <CardDescription>
            Une ligne par lot d&apos;achat (regroupé par commande + événement + prix), colonnes
            au format du template externe fourni. Certains champs du template n&apos;ont pas
            d&apos;équivalent chez nous (acheteur, nom du client, type de billet) et restent
            vides.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {proBillets && (
            <Button
              variant="outline"
              onClick={() => handleBilletsTemplateExport(proBillets)}
              disabled={loadingKey !== null}
            >
              <Download />
              {loadingKey === `template-${proBillets.id}` ? "Export en cours..." : "Exporter CSV Billets Pro (template)"}
            </Button>
          )}
          {persoBillets && (
            <Button
              variant="outline"
              onClick={() => handleBilletsTemplateExport(persoBillets)}
              disabled={loadingKey !== null}
            >
              <Download />
              {loadingKey === `template-${persoBillets.id}` ? "Export en cours..." : "Exporter CSV Billets Perso (template)"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export complet</CardTitle>
          <CardDescription>
            Un CSV par périmètre avec tout le Stock, les Ventes, les Événements, et les Achats
            pro / Charges perso — toutes catégories confondues (Billets, Prestations, Merch...).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => handleScopeExport("PRO")} disabled={loadingKey !== null}>
            <Download />
            {loadingKey === "PRO" ? "Export en cours..." : "Exporter CSV Pro"}
          </Button>
          <Button variant="outline" onClick={() => handleScopeExport("PERSO")} disabled={loadingKey !== null}>
            <Download />
            {loadingKey === "PERSO" ? "Export en cours..." : "Exporter CSV Perso"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export par catégorie</CardTitle>
          <CardDescription>
            Un CSV par catégorie (Stock + Ventes + Événements de cette seule catégorie). Les
            Achats pro / Charges perso ne sont pas rattachés à une catégorie précise, donc pas
            inclus ici — utilise l&apos;export complet ci-dessus pour les récupérer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {proCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Pro</span>
              <div className="flex flex-wrap gap-3">
                {proCategories.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    onClick={() => handleCategoryExport(c)}
                    disabled={loadingKey !== null}
                  >
                    <Download />
                    {loadingKey === c.id ? "Export en cours..." : c.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {persoCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Perso</span>
              <div className="flex flex-wrap gap-3">
                {persoCategories.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    onClick={() => handleCategoryExport(c)}
                    disabled={loadingKey !== null}
                  >
                    <Download />
                    {loadingKey === c.id ? "Export en cours..." : c.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
