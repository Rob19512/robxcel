-- CreateIndex
CREATE INDEX "AchatPro_deletedAt_idx" ON "AchatPro"("deletedAt");

-- CreateIndex
CREATE INDEX "ChargePerso_deletedAt_idx" ON "ChargePerso"("deletedAt");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "Sale_categoryId_deletedAt_idx" ON "Sale"("categoryId", "deletedAt");

-- CreateIndex
CREATE INDEX "Sale_deletedAt_statut_idx" ON "Sale"("deletedAt", "statut");

-- CreateIndex
CREATE INDEX "StockItem_categoryId_deletedAt_idx" ON "StockItem"("categoryId", "deletedAt");

-- CreateIndex
CREATE INDEX "StockItem_deletedAt_statut_idx" ON "StockItem"("deletedAt", "statut");
