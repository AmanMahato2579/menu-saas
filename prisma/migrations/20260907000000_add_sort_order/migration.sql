-- Additive sorting: categories and menu items get an explicit display-order
-- column. Existing rows simply default to 0 and keep their creation order via
-- the createdAt tie-breaker until the owner reorders them.
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MenuItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;