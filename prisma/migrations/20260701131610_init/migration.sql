-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('BIEN', 'SERVICE');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('EN_STOCK', 'EN_ATTENTE', 'VENDU');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('EN_ATTENTE', 'ENCAISSE', 'LITIGE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENT', 'NORMAL', 'PAS_PRESSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "kind" "CategoryKind" NOT NULL,
    "hasStock" BOOLEAN NOT NULL DEFAULT true,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryField" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showInStock" BOOLEAN NOT NULL DEFAULT true,
    "showInSale" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorySource" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "appliesToStock" BOOLEAN NOT NULL DEFAULT true,
    "appliesToSale" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dateAchat" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "coutAchatUnit" DECIMAL(12,2) NOT NULL,
    "prixCibleVente" DECIMAL(12,2),
    "priorite" "Priority" NOT NULL DEFAULT 'NORMAL',
    "tauxTvaAchat" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "dateVente" TIMESTAMP(3),
    "dateEncaissement" TIMESTAMP(3),
    "statut" "StockStatus" NOT NULL DEFAULT 'EN_STOCK',
    "compteEmail" TEXT,
    "notes" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dateVente" TIMESTAMP(3) NOT NULL,
    "dateEncaissement" TIMESTAMP(3),
    "source" TEXT,
    "statut" "SaleStatus" NOT NULL DEFAULT 'ENCAISSE',
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "prixVenteUnit" DECIMAL(12,2) NOT NULL,
    "coutAchatUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tauxTvaVente" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tauxTvaAchat" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchatPro" (
    "id" TEXT NOT NULL,
    "dateAchat" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "montantHt" DECIMAL(12,2) NOT NULL,
    "tauxTva" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchatPro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryField_categoryId_key_key" ON "CategoryField"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CategorySource_categoryId_label_key" ON "CategorySource"("categoryId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_saleId_key" ON "StockItem"("saleId");

-- AddForeignKey
ALTER TABLE "CategoryField" ADD CONSTRAINT "CategoryField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySource" ADD CONSTRAINT "CategorySource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
