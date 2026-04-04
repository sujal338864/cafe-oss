-- Add missing columns to Shop
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "invoiceSettings" JSONB DEFAULT '{}';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingRules" JSONB DEFAULT '{}';

-- Add shopId to User if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT;

-- Restoring unique constraints if they are supposed to be there
-- (Assuming email+shopId uniqueness is desired in multi-tenant)
-- We check IF exists is not directly supported in CREATE UNIQUE INDEX for some versions, 
-- but we'll try standard compliant SQL or just skip if it fails.
-- CREATE UNIQUE INDEX IF NOT EXISTS "User_email_shopId_key" ON "User"("email", "shopId");
