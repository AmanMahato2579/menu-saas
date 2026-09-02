-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSISTANCE_REQUEST';

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "isServiceChargeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tableLimit" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "applyServiceCharge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "applyTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customerName" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "menuItemVariantId" TEXT,
ADD COLUMN     "variantName" TEXT;

-- CreateTable
CREATE TABLE "MenuItemVariant" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemVariant_menuItemId_idx" ON "MenuItemVariant"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemVariant_menuItemId_name_key" ON "MenuItemVariant"("menuItemId", "name");

-- AddForeignKey
ALTER TABLE "MenuItemVariant" ADD CONSTRAINT "MenuItemVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemVariantId_fkey" FOREIGN KEY ("menuItemVariantId") REFERENCES "MenuItemVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
