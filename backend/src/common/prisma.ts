import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './context';

// --- PRISMA SINGLETON PATTERN ---
// Prevents nodemon from creating a new connection pool every time a file is saved.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Dedicated client for Analytics/Heavy queries to bypass Pooler (PgBouncer)
// Uses the same singleton guard as basePrisma to prevent connection leaks on hot-reload
const globalForDirectPrisma = global as unknown as { directPrisma: PrismaClient };

export const directPrisma =
  globalForDirectPrisma.directPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL
      }
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDirectPrisma.directPrisma = directPrisma;
}

/**
 * Extended Prisma Client with automatic row-level multi-tenancy filters.
 * Any model query implicitly isolates output by context.shopId.
 */
const modelsWithShopId = [
  'User', 'Product', 'Category', 'Customer', 'Order', 
  'Supplier', 'Purchase', 'Expense', 'Notification', 'Subscription'
];

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).where = { ...(args as any).where, shopId: tenant.shopId };
        }
        return query(args);
      },
      async findFirst({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).where = { ...(args as any).where, shopId: tenant.shopId };
        }
        return query(args);
      },
      // NOTE: findUnique is intentionally NOT intercepted here.
      // Prisma's findUnique REQUIRES exactly one unique index selector.
      // Injecting shopId would break compound queries and cause runtime errors.
      // Use findFirst (intercepted above) at call sites requiring tenant isolation.
      //
      // NOTE: update and delete are also NOT intercepted globally because
      // the WHERE clause for updates often uses PK only (e.g. { id: '...' }).
      // Each route explicitly passes shopId in its findFirst ownership-check
      // before calling update/delete.
      async create({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).data = { ...(args as any).data, shopId: tenant.shopId };
        }
        return query(args);
      }
    }
  }
});
