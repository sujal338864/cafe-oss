const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  try {
    console.log('--- REPAIRING DATABASE SCHEMA ---');
    
    // Add shopId to User if missing
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT`);
    console.log('Checked "User" table for "shopId"');

    // Add invoiceSettings to Shop if missing
    await client.query(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "invoiceSettings" JSONB DEFAULT '{}'`);
    console.log('Checked "Shop" table for "invoiceSettings"');

    // Add pricingEnabled to Shop if missing (seen in schema.prisma but maybe missing in DB)
    await client.query(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingEnabled" BOOLEAN DEFAULT false`);
    console.log('Checked "Shop" table for "pricingEnabled"');

    // Add pricingRules to Shop if missing
    await client.query(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingRules" JSONB DEFAULT '{}'`);
    console.log('Checked "Shop" table for "pricingRules"');

    console.log('SCHEMA REPAIR COMPLETED');
  } catch (err) {
    console.error('ERROR DURING REPAIR:', err);
  } finally {
    await client.end();
  }
}

run();
