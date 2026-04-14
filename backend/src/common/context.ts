import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  shopId: string;
  isSuperAdmin?: boolean;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Get current tenant context
 */
export const getTenantContext = (): TenantContext | undefined => {
  return tenantContextStorage.getStore();
};

/**
 * Get current shopId safely, throws error if accessed outside a context
 */
export const getCurrentShopId = (): string => {
  const context = getTenantContext();
  if (!context || !context.shopId) {
    throw new Error('Tenant context is missing or not initialized');
  }
  return context.shopId;
};
