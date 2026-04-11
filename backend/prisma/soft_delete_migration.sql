-- ============================================================
--  ShopOS — Soft Delete Migration
--  Adds deletedAt column to Expense table for audit trail.
--  Run: psql $DIRECT_URL -f soft_delete_migration.sql
-- ============================================================

-- Add soft-delete support to Expense (preserve for tax/GST audit trail)
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update the expenses list query to filter out soft-deleted records
-- (handled in application code via: where: { deletedAt: null })

-- Create an index for efficient filtering
CREATE INDEX IF NOT EXISTS "expense_soft_delete_idx" ON "Expense" ("shopId", "deletedAt")
  WHERE "deletedAt" IS NULL;

SELECT 'Soft delete migration complete.' AS status;
