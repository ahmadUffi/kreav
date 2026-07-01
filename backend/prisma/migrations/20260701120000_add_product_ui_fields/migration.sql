-- BE-027: Add UI display fields (emoji, accent, category) to products table.
-- These are nullable so existing rows are unaffected.
ALTER TABLE "products" ADD COLUMN "emoji" TEXT;
ALTER TABLE "products" ADD COLUMN "accent" TEXT;
ALTER TABLE "products" ADD COLUMN "category" TEXT;
