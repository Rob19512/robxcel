-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "trackPriorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackRecu" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "description" TEXT,
ADD COLUMN     "recu" BOOLEAN,
ALTER COLUMN "priorite" DROP NOT NULL,
ALTER COLUMN "priorite" DROP DEFAULT;
