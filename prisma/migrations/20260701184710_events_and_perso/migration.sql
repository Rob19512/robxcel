-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('PRO', 'PERSO');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "scope" "CategoryScope" NOT NULL DEFAULT 'PRO',
ADD COLUMN     "trackEvents" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateEvenement" TIMESTAMP(3),
    "lieuSalle" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
