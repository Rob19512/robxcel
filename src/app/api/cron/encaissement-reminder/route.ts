import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eur } from "@/lib/format";

export const dynamic = "force-dynamic";

async function buildEmailContent() {
  const [prestationsEnAttente, autresEnAttente] = await Promise.all([
    prisma.sale.findMany({
      where: { categoryId: "cat-prestations", deletedAt: null, dateEncaissement: null },
      orderBy: { dateVente: "asc" },
    }),
    Promise.all([
      prisma.stockItem.count({ where: { deletedAt: null, statut: "EN_ATTENTE" } }),
      prisma.sale.count({
        where: { deletedAt: null, dateEncaissement: null, categoryId: { not: "cat-prestations" } },
      }),
    ]).then(([stock, sales]) => stock + sales),
  ]);

  const total = prestationsEnAttente.reduce((sum, s) => sum + s.qty * Number(s.prixVenteUnit), 0);

  const prestationsSection =
    prestationsEnAttente.length === 0
      ? `<p>Aucune prestation en attente d'encaissement — rien à saisir de ce côté. 👍</p>`
      : `
        <p>${prestationsEnAttente.length} prestation(s) facturée(s) mais pas encore marquée(s) encaissée(s), pour ${eur.format(total)} :</p>
        <ul>
          ${prestationsEnAttente
            .map(
              (s) =>
                `<li>${s.description ?? "Sans description"} — ${eur.format(s.qty * Number(s.prixVenteUnit))} (vendu le ${s.dateVente.toLocaleDateString("fr-FR")})</li>`
            )
            .join("")}
        </ul>
      `;

  const footer =
    autresEnAttente > 0
      ? `<p style="color:#666">Sinon, ${autresEnAttente} article(s) (billets/merch) attendent encore une vente ou un encaissement — <a href="https://robxcel.vercel.app/a-encaisser">détail sur la page À encaisser</a>.</p>`
      : "";

  const subject =
    prestationsEnAttente.length > 0
      ? `Robxcel — ${prestationsEnAttente.length} prestation(s) à encaisser (${eur.format(total)})`
      : "Robxcel — rien à encaisser côté prestations 👍";

  return { subject, html: prestationsSection + footer };
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!resendApiKey || !to) {
    return NextResponse.json({ error: "RESEND_API_KEY ou ADMIN_EMAIL manquant" }, { status: 500 });
  }

  const { subject, html } = await buildEmailContent();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Robxcel <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: "Échec envoi email", detail: errText }, { status: 502 });
  }

  return NextResponse.json({ ok: true, subject });
}
