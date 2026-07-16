-- CreateEnum
CREATE TYPE "ImportedListingStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "ImportedListing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "status" "ImportedListingStatus" NOT NULL DEFAULT 'PENDING',
    "numeroCommande" TEXT,
    "eventName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "lieuSalle" TEXT,
    "categorie" TEXT,
    "qty" INTEGER NOT NULL,
    "coutAchatUnit" DECIMAL(12,2) NOT NULL,
    "seats" JSONB NOT NULL,
    "rawEmailText" TEXT NOT NULL,
    "createdStockItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "ImportedListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedListing_gmailMessageId_key" ON "ImportedListing"("gmailMessageId");

-- CreateIndex
CREATE INDEX "ImportedListing_status_idx" ON "ImportedListing"("status");
