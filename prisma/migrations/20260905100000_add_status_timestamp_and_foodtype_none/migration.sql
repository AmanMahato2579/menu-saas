-- Add statusChangedAt to Order for efficient 24-hour retention queries.
-- Existing rows default to now(); we seed the column from updatedAt so that
-- already-completed/rejected orders keep an accurate status-change timestamp.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Order" SET "statusChangedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "statusChangedAt" IS NULL OR "statusChangedAt" = CURRENT_TIMESTAMP;

-- Composite index supporting retention queries: WHERE restaurant_id = ? AND
-- status IN (COMPLETED, REJECTED) AND statusChangedAt >= ?.
CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_statusChangedAt_idx"
ON "Order"("restaurantId", "status", "statusChangedAt");

-- Ensure MenuItemVariant has a foodType column (schema-drift safety; the
-- original variants migration predates this column).
ALTER TABLE "MenuItemVariant" ADD COLUMN IF NOT EXISTS "foodType" TEXT;

-- Normalize any NULL/legacy foodType values to a clean, supported set and keep
-- the Veg/Non-Veg indicators working for old records. NEW = "None / Other".
UPDATE "MenuItem" SET "foodType" = 'NONE'
WHERE "foodType" IS NULL OR "foodType" NOT IN ('VEG', 'NON_VEG', 'NONE');

UPDATE "MenuItemVariant" SET "foodType" = 'NONE'
WHERE "foodType" IS NULL OR "foodType" NOT IN ('VEG', 'NON_VEG', 'NONE');

-- Enforce a whitelist so no invalid food-type values enter the database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuItem_foodType_check'
  ) THEN
    ALTER TABLE "MenuItem"
      ADD CONSTRAINT "MenuItem_foodType_check"
      CHECK ("foodType" IN ('VEG', 'NON_VEG', 'NONE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuItemVariant_foodType_check'
  ) THEN
    ALTER TABLE "MenuItemVariant"
      ADD CONSTRAINT "MenuItemVariant_foodType_check"
      CHECK ("foodType" IN ('VEG', 'NON_VEG', 'NONE'));
  END IF;
END $$;
