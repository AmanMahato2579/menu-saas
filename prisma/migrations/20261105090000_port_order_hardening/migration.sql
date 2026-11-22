-- Tier 1: order hardening + account forced-logout
ALTER TABLE "Order" ADD COLUMN "serviceChargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "clientRequestId" TEXT;
ALTER TABLE "User"  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Order_tableSessionId_clientRequestId_key"
  ON "Order"("tableSessionId","clientRequestId");
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId","createdAt");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
CREATE INDEX "TableSession_restaurantId_status_idx" ON "TableSession"("restaurantId","status");
CREATE INDEX "TableSession_status_startedAt_idx" ON "TableSession"("status","startedAt");
CREATE INDEX "Booking_serviceId_bookingDate_status_idx"
  ON "Booking"("serviceId","bookingDate","status");
