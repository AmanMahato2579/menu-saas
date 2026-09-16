-- Waiter ordering + per-item status (Table Session architecture)
-- ===============================================================
-- Enables the owner/waiter to place verbal orders onto any table session and
-- tracks food status per OrderItem (NEW → PREPARING → SERVED) instead of a
-- single order-level battlefield status.

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('NEW', 'PREPARING', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('CUSTOMER', 'WAITER');

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "requiresPreparation" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "status" "OrderItemStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "servedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cancelledReason" TEXT;

-- Backfill: any existing order items from before this migration were treated
-- as served/complete by the old order-level lifecycle. Mark them SERVED so
-- historical bills stay truthful rather than reappearing as "NEW".
UPDATE "OrderItem" oi
SET "status" = 'SERVED', "servedQuantity" = oi."quantity"
FROM "Order" o
WHERE oi."orderId" = o."id"
  AND o."status" IN ('COMPLETED', 'READY', 'PREPARING', 'ACCEPTED');

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");