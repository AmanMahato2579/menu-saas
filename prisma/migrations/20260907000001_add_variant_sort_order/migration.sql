-- Additive sorting: menu item variants get an explicit display-order column.
-- Existing rows simply default to 0 and keep their creation order via the
-- createdAt tie-breaker until the owner reorders them.
ALTER TABLE "MenuItemVariant" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;