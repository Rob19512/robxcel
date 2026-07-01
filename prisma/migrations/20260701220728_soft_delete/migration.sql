-- AlterTable
ALTER TABLE "AchatPro" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);
