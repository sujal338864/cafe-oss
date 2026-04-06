/**
 * fix_schema.js — Surgical fix for the Role enum / Membership blocker
 * 
 * The problem: a stale "Role_old" enum exists in Postgres (from a failed
 * Prisma migration). The Membership table's `role` column still depends on it,
 * so Prisma cannot drop the old enum or push schema changes.
 *
 * This script:
 *  1. Migrates Membership.role values to text temporarily
 *  2. Drops the old Role_old type
 *  3. Re-casts the column to use the current Role enum
 *
 * Run BEFORE `npx prisma db push --accept-data-loss`
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
    // If object doesn't exist, that's fine — continue
    if (msg.includes('does not exist') || msg.includes('unknown type')) {
      console.log(`\r[--] ${label} (skipped — already fixed)`);
    } else {
      console.log(`\r[!!] ${label}`);
      console.error('    ', msg.split('\n')[0]);
    }
  }
}

async function main() {
  console.log('\n=== Surgical Schema Fix ===\n');

  // 1. Convert Membership.role to plain text to break the enum dependency
  await step('Convert Membership.role to TEXT', () =>
    prisma.$executeRawUnsafe(`ALTER TABLE "Membership" ALTER COLUMN "role" TYPE TEXT;`)
  );

  // 2. Drop stale Role_old enum
  await step('Drop stale Role_old enum', () =>
    prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "Role_old" CASCADE;`)
  );

  // 3. Make sure current Role enum has correct values
  await step('Add ADMIN to Role enum if missing', () =>
    prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';`)
  );
  await step('Add MANAGER to Role enum if missing', () =>
    prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';`)
  );
  await step('Add EMPLOYEE to Role enum if missing', () =>
    prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';`)
  );

  // 4. Fix any stale OWNER/SUPERADMIN values in all tables
  await step('Fix User.role OWNER -> ADMIN', () =>
    prisma.$executeRawUnsafe(`UPDATE "User" SET role = 'ADMIN' WHERE role::text = 'OWNER';`)
  );
  await step('Fix User.role SUPERADMIN -> ADMIN', () =>
    prisma.$executeRawUnsafe(`UPDATE "User" SET role = 'ADMIN' WHERE role::text = 'SUPERADMIN';`)
  );
  await step('Fix Membership.role OWNER -> ADMIN', () =>
    prisma.$executeRawUnsafe(`UPDATE "Membership" SET role = 'ADMIN' WHERE role::text = 'OWNER';`)
  );
  await step('Fix Membership.role SUPERADMIN -> ADMIN', () =>
    prisma.$executeRawUnsafe(`UPDATE "Membership" SET role = 'ADMIN' WHERE role::text = 'SUPERADMIN';`)
  );

  // 5. Re-cast Membership.role back to the Role enum
  await step('Re-cast Membership.role -> Role enum', () =>
    prisma.$executeRawUnsafe(`ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role" USING role::"Role";`)
  );

  console.log('\n=== Done! Now run: npx prisma db push --accept-data-loss ===\n');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
