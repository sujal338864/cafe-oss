/**
 * drop_rls.js — Drop all RLS policies and stale tables blocking prisma db push
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function step(label, fn) {
  process.stdout.write(`[..] ${label}`);
  try {
    await fn();
    console.log(`\r[OK] ${label}`);
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('does not exist')) {
      console.log(`\r[--] ${label} (already gone)`);
    } else {
      console.log(`\r[!!] ${label}: ${msg.split('\n')[0]}`);
    }
  }
}

async function main() {
  console.log('\n=== Dropping RLS Policies & Stale Tables ===\n');

  // Get all RLS policies
  const policies = await prisma.$queryRaw`
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  `;
  console.log(`Found ${policies.length} RLS policies to drop.`);

  for (const { policyname, tablename } of policies) {
    await step(`Drop policy "${policyname}" on "${tablename}"`, () =>
      prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "${policyname}" ON "public"."${tablename}";`)
    );
  }

  // Disable RLS on all tables
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const { tablename } of tables) {
    await step(`Disable RLS on "${tablename}"`, () =>
      prisma.$executeRawUnsafe(`ALTER TABLE "public"."${tablename}" DISABLE ROW LEVEL SECURITY;`)
    );
  }

  // Drop stale tables not in schema
  for (const t of ['ShopMember', 'Membership', 'Subscription']) {
    await step(`Drop stale table "${t}"`, () =>
      prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${t}" CASCADE;`)
    );
  }

  console.log('\n=== Done! Now run: npx prisma db push --accept-data-loss ===\n');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
