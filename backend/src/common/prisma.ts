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
  // Note: 'Membership' is excluded here to allow cross-tenant shop switching via current user ID
];

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const tenant = getTenantContext();
        
        // Ensure args is always an object to prevent crashes
        if (!args) args = {};

        if (tenant?.shopId && modelsWithShopId.includes(model) && !tenant.isSuperAdmin) {
          // 1. Inject filters into read operations
          if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...(args.where || {}), shopId: tenant.shopId };
          }
          // 2. Inject shopId into write operations if not explicitly provided
          if (['create', 'createMany'].includes(operation)) {
            if (operation === 'create') {
              if (!args.data?.shopId) {
                args.data = { ...(args.data || {}), shopId: tenant.shopId };
              }
            } else {
              // createMany
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, shopId: tenant.shopId }));
              }
            }
          }
          // 3. Inject ownership validation into update/delete
          if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
            args.where = { ...(args.where || {}), shopId: tenant.shopId };
          }
        }
        return query(args);
      }
    }
  }
});
