-- AlterTable
ALTER TABLE "Category" ADD COLUMN "defaultTauxTvaVente" DECIMAL(5,2),
ADD COLUMN "defaultTauxTvaAchat" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "tvaAssujettiDepuis" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
