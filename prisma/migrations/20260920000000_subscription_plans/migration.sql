-- MenuQR subscription/plan/star overhaul (additive only, existing data preserved)

-- Extend Restaurant with subscription + star (first-10) fields.
ALTER TABLE "Restaurant"
  ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "subscriptionStart" TIMESTAMP(3),
  ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "neverExpires" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoOff" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "starNumber" INTEGER,
  ADD COLUMN "starNote" TEXT,
  ADD COLUMN "featureOverrides" TEXT,
  ADD COLUMN "limitOverrides" TEXT;

-- Backfill the subscription start date from the creation date.
UPDATE "Restaurant" SET "subscriptionStart" = "createdAt" WHERE "subscriptionStart" IS NULL;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" DECIMAL(10,2),
    "priceYearly" DECIMAL(10,2),
    "featureKeys" TEXT NOT NULL DEFAULT '[]',
    "limitKeys" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivity" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "restaurantId" TEXT,
    "restaurantName" TEXT,
    "detail" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_starNumber_key" ON "Restaurant"("starNumber");

-- CreateIndex
CREATE INDEX "AdminActivity_restaurantId_idx" ON "AdminActivity"("restaurantId");

-- CreateIndex
CREATE INDEX "AdminActivity_createdAt_idx" ON "AdminActivity"("createdAt");

-- Seed the visible plan catalog (BRONZE / SILVER / STAR).
-- Gold is intentionally NOT inserted yet; the architecture supports it later.
INSERT INTO "Plan" ("id", "name", "description", "featureKeys", "limitKeys", "sortOrder", "isVisible", "isActive", "createdAt", "updatedAt")
VALUES
  ('BRONZE', 'Bronze', 'Digital menu & restaurant profile. View-only — no ordering.', '["restaurant_profile","digital_menu","menu_management","qr_tables"]', '{"qrTables":10}', 10, true, true, NOW(), NOW()),
  ('SILVER', 'Silver', 'Everything in Bronze, plus full QR ordering, table ordering and order management.', '["restaurant_profile","digital_menu","menu_management","qr_tables","ordering","table_ordering","order_management","kitchen_workflow","order_history"]', '{"qrTables":20}', 20, true, true, NOW(), NOW()),
  ('STAR', 'Star', 'Founding customer. Access to ALL current and future MenuQR features.', '["ALL_CURRENT_FEATURES"]', '{"qrTables":50}', 30, true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Backfill: restaurants marked GOLD in the old UI are kept on their effective plan
-- but never shown as an active customer plan. Reassign them to STAR so nothing
-- silently loses access; GOLD becomes invisible and unused going forward.
UPDATE "Restaurant" SET "plan" = 'STAR' WHERE "plan" = 'GOLD';