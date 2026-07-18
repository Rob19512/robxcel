-- CreateTable
CREATE TABLE "TicketingSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tauxTvaAchat" DECIMAL(5,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketingSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketingSite_name_key" ON "TicketingSite"("name");

-- Reprend la liste jusqu'ici codée en dur (src/lib/ticketing-sites.ts) comme données de
-- départ, avec le taux de TVA récupérable connu pour Ticketmaster (5,5%) ; les autres
-- restent à renseigner au cas par cas depuis /tva.
INSERT INTO "TicketingSite" ("id", "name", "tauxTvaAchat", "sortOrder") VALUES
    ('site-ticketmaster', 'Ticketmaster', 5.5, 0),
    ('site-fnac-spectacles', 'Fnac Spectacles', NULL, 1),
    ('site-france-billet', 'France Billet', NULL, 2),
    ('site-see-tickets', 'See Tickets', NULL, 3),
    ('site-axs', 'AXS', NULL, 4),
    ('site-eventim', 'Eventim', NULL, 5),
    ('site-digitick', 'Digitick', NULL, 6),
    ('site-weezevent', 'Weezevent', NULL, 7),
    ('site-shotgun', 'Shotgun', NULL, 8),
    ('site-billetweb', 'Billetweb', NULL, 9),
    ('site-ticketone', 'TicketOne', NULL, 10),
    ('site-vivaticket', 'Vivaticket', NULL, 11),
    ('site-ticketek', 'Ticketek', NULL, 12),
    ('site-dice', 'Dice', NULL, 13);
