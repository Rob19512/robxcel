-- CreateTable
CREATE TABLE "ChargePerso" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "montant" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargePerso_pkey" PRIMARY KEY ("id")
);
