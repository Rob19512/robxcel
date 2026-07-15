-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "EventFolder" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventFolder_categoryId_name_key" ON "EventFolder"("categoryId", "name");

-- CreateIndex
CREATE INDEX "Event_folderId_idx" ON "Event"("folderId");

-- AddForeignKey
ALTER TABLE "EventFolder" ADD CONSTRAINT "EventFolder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "EventFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
