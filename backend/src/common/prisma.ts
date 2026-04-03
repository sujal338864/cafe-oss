import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './context';

// Initialize the base client
const basePrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

// Dedicated client for Analytics/Heavy queries to bypass Pooler (PgBouncer)
export const directPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

/**
 * Extended Prisma Client with automatic row-level multi-tenancy filters.
 * Any model query implicitly isolates output by context.shopId.
 */
const modelsWithShopId = [
  'User', 'Product', 'Category', 'Customer', 'Order', 
  'Supplier', 'Purchase', 'Expense', 'Notification', 'Subscription'
];

export const prisma = (basePrisma.$extends({
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
      async findUnique({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).where = { ...(args as any).where, shopId: tenant.shopId };
        }
        return query(args);
      },
      async update({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).where = { ...(args as any).where, shopId: tenant.shopId };
        }
        return query(args);
      },
      async delete({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).where = { ...(args as any).where, shopId: tenant.shopId };
        }
        return query(args);
      },
      async create({ model, args, query }: any) {
        const tenant = getTenantContext();
        if (tenant?.shopId && modelsWithShopId.includes(model)) {
          (args as any).data = { ...(args as any).data, shopId: tenant.shopId };
        }
        return query(args);
      }
    }
  }
}) as any);
