import { PrismaClient, PaymentMethod, ExpenseCategory, Role, Plan, StockType, PaymentStatus, OrderStatus } from '../generated/client';
export { PaymentMethod, ExpenseCategory, Role, Plan, StockType, PaymentStatus, OrderStatus };
import { getTenantContext } from './context';

// --- PRISMA SINGLETON PATTERN ---
const globalForPrisma = global as unknown as { prisma: PrismaClient, directPrisma: PrismaClient };

/**
 * Ensures we only have ONE connection pool even during hot-reloads.
 * Appends safe connection pooling parameters if missing.
 */
const getSafeUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.includes('connection_limit')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=5&pool_timeout=20`;
};

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
    datasources: { db: { url: getSafeUrl(process.env.DATABASE_URL) } },
  });

export const directPrisma =
  globalForPrisma.directPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getSafeUrl(process.env.DIRECT_URL || process.env.DATABASE_URL)
      }
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
  globalForPrisma.directPrisma = directPrisma;
}

/**
 * Extended Prisma Client with automatic row-level multi-tenancy filters.
 * Any model query implicitly isolates output by context.shopId.
 */
const modelsWithShopId = [
  'User', 'Product', 'Category', 'Customer', 'Order', 
  'Supplier', 'Purchase', 'Expense', 'Notification', 'Subscription',
  'Combo', 'BranchComboOverride'
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
