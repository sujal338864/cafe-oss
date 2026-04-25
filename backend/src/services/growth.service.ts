// Growth Engine Service — Coupon, Segments, KPIs, Rules Engine
import { prisma } from '../common/prisma';

import { logger } from '../lib/logger';
import { getCache, setCache } from '../common/cache';


// ─── Types ───────────────────────────────────────────────────────────────────

export interface GrowthKPIs {
  revenue: {
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    growthPct: number;
    avgBasket: number;
    monthOrders: number;
  };
  customers: {
    total: number;
    newThisWeek: number;
    repeatRate: number;
    inactive30d: number;
    inactive60d: number;
  };
  products: {
    topItems: { name: string; revenue: number; quantity: number }[];
    lowItems: { name: string; stock: number; price: number }[];
  };
}

export interface SegmentCounts {
  VIP: number;
  FREQUENT: number;
  NEW: number;
  INACTIVE_30D: number;
  INACTIVE_60D: number;
  HIGH_SPENDER: number;
}

export interface SuggestedAction {
  id: string;
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  icon: string;
  title: string;
  description: string;
  metric: string;
  ctaLabel: string;
  ctaHref: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const GrowthService = {

  /**
   * All growth KPIs in a single mega-CTE round trip.
   * Cached 60s. Zero schema changes needed.
   */
  async getGrowthKPIs(shopId: string): Promise<GrowthKPIs> {
    const cacheKey = `growth:kpis:${shopId}`;
    try {
      const cached = await getCache<GrowthKPIs>(cacheKey);
      if (cached) return cached;
    } catch (_) {}

    try {
      const now7  = new Date(Date.now() - 7  * 86_400_000);
      const now14 = new Date(Date.now() - 14 * 86_400_000);
      const now30 = new Date(Date.now() - 30 * 86_400_000);
      const now60 = new Date(Date.now() - 60 * 86_400_000);

      const [row] = await prisma.$queryRaw<any[]>`
        WITH
        w AS (
          SELECT COALESCE(SUM("totalAmount"),0)::float rev,
                 COUNT(*)::int cnt,
                 CASE WHEN COUNT(*)>0 THEN (COALESCE(SUM("totalAmount"),0)/COUNT(*))::float ELSE 0 END avg
          FROM "Order" WHERE "shopId"=${shopId} AND status!='CANCELLED' AND "createdAt">=${now7}
        ),
        pw AS (
          SELECT COALESCE(SUM("totalAmount"),0)::float rev
          FROM "Order" WHERE "shopId"=${shopId} AND status!='CANCELLED'
            AND "createdAt">=${now14} AND "createdAt"<${now7}
        ),
        m AS (
          SELECT COALESCE(SUM("totalAmount"),0)::float rev, COUNT(*)::int cnt
          FROM "Order" WHERE "shopId"=${shopId} AND status!='CANCELLED' AND "createdAt">=${now30}
        ),
        ct AS ( SELECT COUNT(*)::int n FROM "Customer" WHERE "shopId"=${shopId} ),
        cn AS ( SELECT COUNT(*)::int n FROM "Customer" WHERE "shopId"=${shopId} AND "createdAt">=${now7} ),
        rep AS (
          SELECT COUNT(DISTINCT "customerId")::int tot,
                 COUNT(DISTINCT CASE WHEN oc>1 THEN "customerId" END)::int rpt
          FROM (
            SELECT "customerId", COUNT(*)::int oc FROM "Order"
            WHERE "shopId"=${shopId} AND "customerId" IS NOT NULL AND status!='CANCELLED'
            GROUP BY "customerId"
          ) s
        ),
        i30 AS (
          SELECT COUNT(DISTINCT c.id)::int n FROM "Customer" c
          WHERE c."shopId"=${shopId}
            AND EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId})
            AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o."createdAt">=${now30})
        ),
        i60 AS (
          SELECT COUNT(DISTINCT c.id)::int n FROM "Customer" c
          WHERE c."shopId"=${shopId}
            AND EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId})
            AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o."createdAt">=${now60})
        )
        SELECT w.rev wrev, w.cnt wcnt, w.avg wavg, pw.rev prev, m.rev mrev, m.cnt mcnt,
               ct.n ctotal, cn.n cnew, rep.tot rtot, rep.rpt rrpt, i30.n i30n, i60.n i60n
        FROM w,pw,m,ct,cn,rep,i30,i60
      `;

      const wrev = Number(row?.wrev || 0);
      const prev = Number(row?.prev || 0);
      const growthPct = prev > 0 ? Math.round(((wrev - prev) / prev) * 1000) / 10 : 0;
      const repeatRate = Number(row?.rtot || 0) > 0
        ? Math.round((Number(row?.rrpt || 0) / Number(row?.rtot || 1)) * 1000) / 10
        : 0;

      // Top 5 products (30d) — grouped aggregation
      const topRaw = await prisma.orderItem.groupBy({
        by: ['productId', 'name'],
        _sum: { total: true, quantity: true },
        where: { order: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: now30 } } },
        orderBy: { _sum: { total: 'desc' } },
        take: 5
      });

      // Low performers: active products with zero sales in 30d
      const soldProductIds = new Set(
        (await prisma.orderItem.groupBy({
          by: ['productId'],
          where: { order: { shopId, createdAt: { gte: now30 } } }
        })).map(x => x.productId)
      );

      const activeProducts = await prisma.product.findMany({
        where: { shopId, isActive: true },
        select: { id: true, name: true, stock: true, sellingPrice: true },
        take: 100
      });
      const lowItems = activeProducts.filter(p => !soldProductIds.has(p.id)).slice(0, 5);

      const result: GrowthKPIs = {
        revenue: {
          thisWeek: wrev,
          lastWeek: prev,
          thisMonth: Number(row?.mrev || 0),
          growthPct,
          avgBasket: Number(row?.wavg || 0),
          monthOrders: Number(row?.mcnt || 0)
        },
        customers: {
          total: Number(row?.ctotal || 0),
          newThisWeek: Number(row?.cnew || 0),
          repeatRate,
          inactive30d: Number(row?.i30n || 0),
          inactive60d: Number(row?.i60n || 0)
        },
        products: {
          topItems: topRaw.map(t => ({
            name: t.name,
            revenue: Number(t._sum.total || 0),
            quantity: Number(t._sum.quantity || 0)
          })),
          lowItems: lowItems.map(p => ({
            name: p.name,
            stock: p.stock,
            price: Number(p.sellingPrice)
          }))
        }
      };

    await setCache(cacheKey, result, 60);
      return result;
    } catch (err: any) {
      logger.error(`[GROWTH] KPI query failed: ${err.message}`);
      return {
        revenue: { thisWeek: 0, lastWeek: 0, thisMonth: 0, growthPct: 0, avgBasket: 0, monthOrders: 0 },
        customers: { total: 0, newThisWeek: 0, repeatRate: 0, inactive30d: 0, inactive60d: 0 },
        products: { topItems: [], lowItems: [] }
      };
    }
  },

  /**
   * Customer segment counts — parallel queries, cached 2min.
   */
  async getSegmentCounts(shopId: string): Promise<SegmentCounts> {
    const cacheKey = `growth:segs:${shopId}`;
    try {
      const cached = await getCache<SegmentCounts>(cacheKey);
      if (cached) return cached;
    } catch (_) {}

    const now14 = new Date(Date.now() - 14 * 86_400_000);
    const now30 = new Date(Date.now() - 30 * 86_400_000);
    const now60 = new Date(Date.now() - 60 * 86_400_000);
    const now90 = new Date(Date.now() - 90 * 86_400_000);

    const [vipR, freqR, newR, i30R, i60R, highR] = await Promise.all([
      // VIP: 3+ orders AND totalPurchases >= 1.5× shop average
      prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(*)::bigint n FROM "Customer" c WHERE c."shopId"=${shopId} AND c."totalPurchases">0
          AND (SELECT COUNT(*) FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o.status!='CANCELLED')>=3
          AND c."totalPurchases">=(SELECT COALESCE(AVG("totalPurchases"),0)*1.5 FROM "Customer" WHERE "shopId"=${shopId} AND "totalPurchases">0)
      `,
      // FREQUENT: 3+ orders in last 30 days
      prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(*)::bigint n FROM (
          SELECT "customerId" FROM "Order"
          WHERE "shopId"=${shopId} AND "customerId" IS NOT NULL AND status!='CANCELLED' AND "createdAt">=${now30}
          GROUP BY "customerId" HAVING COUNT(*)>=3
        ) s
      `,
      // NEW: joined last 14 days
      prisma.customer.count({ where: { shopId, createdAt: { gte: now14 } } }),
      // INACTIVE 30-90d
      prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(DISTINCT c.id)::bigint n FROM "Customer" c
        WHERE c."shopId"=${shopId}
          AND EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId})
          AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o."createdAt">=${now30})
          AND EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o."createdAt">=${now90})
      `,
      // INACTIVE 60d+
      prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(DISTINCT c.id)::bigint n FROM "Customer" c
        WHERE c."shopId"=${shopId}
          AND EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId})
          AND NOT EXISTS(SELECT 1 FROM "Order" o WHERE o."customerId"=c.id AND o."shopId"=${shopId} AND o."createdAt">=${now60})
      `,
      // HIGH SPENDER: total purchases > ₹5,000
      prisma.customer.count({ where: { shopId, totalPurchases: { gt: 5000 } } })
    ]);

    const result: SegmentCounts = {
      VIP:          Number(vipR[0]?.n  || 0),
      FREQUENT:     Number(freqR[0]?.n || 0),
      NEW:          Number(newR   || 0),
      INACTIVE_30D: Number(i30R[0]?.n  || 0),
      INACTIVE_60D: Number(i60R[0]?.n  || 0),
      HIGH_SPENDER: Number(highR  || 0)
    };

    await setCache(cacheKey, result, 120);
    return result;
  },

  /**
   * Paginated customers for a specific segment.
   */
  async getSegmentCustomers(shopId: string, segment: string, page = 1, limit = 20): Promise<any[]> {
    const skip = (page - 1) * limit;
    const now14 = new Date(Date.now() - 14 * 86_400_000);
    const now30 = new Date(Date.now() - 30 * 86_400_000);
    const now60 = new Date(Date.now() - 60 * 86_400_000);
    const now90 = new Date(Date.now() - 90 * 86_400_000);

    switch (segment.toUpperCase()) {
      case 'VIP':
        return prisma.$queryRaw<any[]>`
          SELECT c.id, c.name, c.phone, c.email, c."totalPurchases"::float,
                 c."loyaltyPoints", COUNT(o.id)::int as "orderCount", MAX(o."createdAt") as "lastOrderAt"
          FROM "Customer" c
          LEFT JOIN "Order" o ON o."customerId"=c.id AND o."shopId"=${shopId} AND o.status!='CANCELLED'
          WHERE c."shopId"=${shopId} AND c."totalPurchases">0
          GROUP BY c.id
          HAVING COUNT(o.id)>=3 AND c."totalPurchases">=(SELECT COALESCE(AVG("totalPurchases"),0)*1.5 FROM "Customer" WHERE "shopId"=${shopId} AND "totalPurchases">0)
          ORDER BY c."totalPurchases" DESC LIMIT ${limit} OFFSET ${skip}
        `;

      case 'FREQUENT':
        return prisma.$queryRaw<any[]>`
          SELECT c.id, c.name, c.phone, c.email, c."totalPurchases"::float,
                 c."loyaltyPoints", COUNT(o.id)::int as "orderCount", MAX(o."createdAt") as "lastOrderAt"
          FROM "Customer" c
          JOIN "Order" o ON o."customerId"=c.id AND o."shopId"=${shopId} AND o.status!='CANCELLED' AND o."createdAt">=${now30}
          WHERE c."shopId"=${shopId}
          GROUP BY c.id HAVING COUNT(o.id)>=3
          ORDER BY COUNT(o.id) DESC LIMIT ${limit} OFFSET ${skip}
        `;

      case 'NEW':
        return prisma.customer.findMany({
          where: { shopId, createdAt: { gte: now14 } },
          select: { id: true, name: true, phone: true, email: true, totalPurchases: true, loyaltyPoints: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: limit, skip
        }) as any;

      case 'INACTIVE_30D':
        return prisma.$queryRaw<any[]>`
          SELECT c.id, c.name, c.phone, c.email, c."totalPurchases"::float,
                 c."loyaltyPoints", COUNT(o.id)::int as "orderCount", MAX(o."createdAt") as "lastOrderAt"
          FROM "Customer" c
          JOIN "Order" o ON o."customerId"=c.id AND o."shopId"=${shopId}
          WHERE c."shopId"=${shopId}
          GROUP BY c.id
          HAVING MAX(o."createdAt")<${now30} AND MAX(o."createdAt")>=${now90}
          ORDER BY MAX(o."createdAt") DESC LIMIT ${limit} OFFSET ${skip}
        `;

      case 'INACTIVE_60D':
        return prisma.$queryRaw<any[]>`
          SELECT c.id, c.name, c.phone, c.email, c."totalPurchases"::float,
                 c."loyaltyPoints", COUNT(o.id)::int as "orderCount", MAX(o."createdAt") as "lastOrderAt"
          FROM "Customer" c
          JOIN "Order" o ON o."customerId"=c.id AND o."shopId"=${shopId}
          WHERE c."shopId"=${shopId}
          GROUP BY c.id HAVING MAX(o."createdAt")<${now60}
          ORDER BY MAX(o."createdAt") ASC LIMIT ${limit} OFFSET ${skip}
        `;

      case 'HIGH_SPENDER':
        return prisma.customer.findMany({
          where: { shopId, totalPurchases: { gt: 5000 } },
          select: { id: true, name: true, phone: true, email: true, totalPurchases: true, loyaltyPoints: true, updatedAt: true },
          orderBy: { totalPurchases: 'desc' },
          take: limit, skip
        }) as any;

      default:
        return [];
    }
  },

  /**
   * Rules-based suggested actions. No ML — pure business logic.
   */
  async getSuggestedActions(shopId: string, kpis?: GrowthKPIs): Promise<SuggestedAction[]> {
    try {
      const [data, segs] = await Promise.all([
        kpis ? Promise.resolve(kpis) : GrowthService.getGrowthKPIs(shopId),
        GrowthService.getSegmentCounts(shopId)
      ]);

      const actions: SuggestedAction[] = [];

      // Rule 1: Many 30d inactive → win-back
      if (segs.INACTIVE_30D >= 5) {
        actions.push({
          id: 'WIN_BACK_30', type: 'WIN_BACK', priority: 'HIGH', icon: '📣',
          title: `${segs.INACTIVE_30D} customers haven't visited in 30 days`,
          description: 'Win-back campaigns recover 20-30% of dormant customers. A 10% discount sent now could bring them back before they\'re gone forever.',
          metric: `${segs.INACTIVE_30D} at-risk customers`,
          ctaLabel: 'Create Win-Back Coupon',
          ctaHref: '/dashboard/growth'
        });
      }

      // Rule 2: Revenue declining week-on-week
      if (data.revenue.growthPct < -10) {
        actions.push({
          id: 'REVENUE_DROP', type: 'FLASH_SALE', priority: 'HIGH', icon: '📉',
          title: `Revenue dropped ${Math.abs(data.revenue.growthPct)}% this week`,
          description: 'Week-on-week revenue is significantly down. A flash sale or bundle offer can quickly drive new orders and recover momentum.',
          metric: `₹${Math.round(data.revenue.lastWeek - data.revenue.thisWeek).toLocaleString('en-IN')} less than last week`,
          ctaLabel: 'Create Flash Coupon',
          ctaHref: '/dashboard/growth'
        });
      }

      // Rule 3: Reward VIPs
      if (segs.VIP > 0) {
        actions.push({
          id: 'VIP_REWARD', type: 'LOYALTY_REWARD', priority: 'MEDIUM', icon: '🏆',
          title: `Reward your ${segs.VIP} VIP customers`,
          description: 'VIP customers generate 3× average revenue. Exclusive early-access offers increase loyalty and average basket size.',
          metric: `${segs.VIP} high-value customers`,
          ctaLabel: 'Create VIP-Only Coupon',
          ctaHref: '/dashboard/growth'
        });
      }

      // Rule 4: Products not selling
      if (data.products.lowItems.length >= 3) {
        const names = data.products.lowItems.slice(0, 2).map(p => p.name).join(', ');
        actions.push({
          id: 'LOW_PRODUCTS', type: 'FLASH_SALE', priority: 'MEDIUM', icon: '📦',
          title: `${data.products.lowItems.length} products have zero sales in 30 days`,
          description: 'Stagnant inventory ties up capital. Bundle slow items with top sellers or run a flash discount to clear stock.',
          metric: `${names}${data.products.lowItems.length > 2 ? ` +${data.products.lowItems.length - 2} more` : ''}`,
          ctaLabel: 'Create Clearance Coupon',
          ctaHref: '/dashboard/growth'
        });
      }

      // Rule 5: Nurture new customers
      if (data.customers.newThisWeek >= 1) {
        actions.push({
          id: 'NEW_NURTURE', type: 'UPSELL', priority: 'LOW', icon: '✨',
          title: `Welcome your ${data.customers.newThisWeek} new customers`,
          description: 'Customers who return within 7 days have 40% higher lifetime value. A first-return offer converts them into regulars.',
          metric: `${data.customers.newThisWeek} new customers this week`,
          ctaLabel: 'Create Welcome Coupon',
          ctaHref: '/dashboard/growth'
        });
      }

      // Rule 6: Low repeat rate
      if (data.customers.repeatRate < 20 && data.customers.total > 10) {
        actions.push({
          id: 'LOW_REPEAT', type: 'LOYALTY_REWARD', priority: 'MEDIUM', icon: '🔄',
          title: `Only ${data.customers.repeatRate}% of customers return`,
          description: 'Low repeat rate means customers aren\'t incentivized to come back. Boost loyalty point rates or add a first-return offer.',
          metric: 'Industry average is 25-40%',
          ctaLabel: 'Adjust Loyalty Rate',
          ctaHref: '/dashboard/settings'
        });
      }

      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return actions.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
    } catch (err: any) {
      logger.error(`[GROWTH] Action rules failed: ${err.message}`);
      return [];
    }
  },

  // ── Coupon Engine ──────────────────────────────────────────────────────────
  // Requires: prisma migrate dev --name add_growth_engine
  // Gracefully returns null/error if migration hasn't been run yet.

  async getCoupons(shopId: string): Promise<any[] | null> {
    try {
      return await (prisma as any).coupon.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, type: true, value: true, minOrder: true,
          maxUses: true, usedCount: true, isFirstOnly: true, isActive: true,
          expiresAt: true, description: true, createdAt: true
        }
      });
    } catch (err: any) {
      if (err.code === 'P2021' || err.message?.includes('does not exist')) return null;
      throw err;
    }
  },

  async createCoupon(shopId: string, data: any): Promise<any> {
    try {
      return await (prisma as any).coupon.create({
        data: { shopId, ...data, code: (data.code as string).toUpperCase().trim() }
      });
    } catch (err: any) {
      if (err.code === 'P2002')  throw new Error('Coupon code already exists for this shop');
      if (err.code === 'P2021' || err.message?.includes('does not exist')) throw new Error('MIGRATION_REQUIRED');
      throw err;
    }
  },

  async deleteCoupon(shopId: string, couponId: string): Promise<void> {
    try {
      await (prisma as any).coupon.delete({ where: { id: couponId, shopId } });
    } catch (err: any) {
      if (err.code === 'P2025') throw new Error('Coupon not found');
      if (err.code === 'P2021') throw new Error('MIGRATION_REQUIRED');
      throw err;
    }
  },

  async validateCoupon(shopId: string, code: string, orderTotal: number, customerId?: string): Promise<{
    valid: boolean; error?: string; coupon?: any; discount?: number; finalTotal?: number;
  }> {
    try {
      const coupon = await (prisma as any).coupon.findFirst({
        where: { shopId, code: code.toUpperCase().trim(), isActive: true }
      });

      if (!coupon)                                                   return { valid: false, error: 'Invalid coupon code' };
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'Coupon has expired' };
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { valid: false, error: 'Coupon usage limit reached' };

      const cMinOrder = typeof coupon.minOrder?.toNumber === 'function' ? coupon.minOrder.toNumber() : Number(coupon.minOrder || 0);
      const cValue = typeof coupon.value?.toNumber === 'function' ? coupon.value.toNumber() : Number(coupon.value || 0);

      if (orderTotal < cMinOrder) return { valid: false, error: `Minimum order amount is ₹${cMinOrder}` };

      if (coupon.isFirstOnly && customerId) {
        const prev = await prisma.order.count({ where: { customerId, shopId, status: { not: 'CANCELLED' as any } } });
        if (prev > 0) return { valid: false, error: 'This coupon is valid for first orders only' };
      }

      const discount = coupon.type === 'PERCENTAGE'
        ? Math.round(orderTotal * cValue / 100 * 100) / 100
        : Math.min(cValue, orderTotal);

      return { valid: true, coupon, discount, finalTotal: Math.max(0, orderTotal - discount) };
    } catch (err: any) {
      if (err.code === 'P2021' || err.message?.includes('does not exist')) {
        return { valid: false, error: 'Coupon system not yet enabled. Run DB migration.' };
      }
      throw err;
    }
  },

  async getCouponAnalytics(shopId: string): Promise<any[]> {
    try {
      const coupons = await (prisma as any).coupon.findMany({
        where: { shopId },
        select: { id: true, code: true, type: true, value: true, usedCount: true }
      });

      const orderStats = await (prisma.order as any).groupBy({
        by: ['couponId' as any],
        where: { 
          shopId, 
          couponId: { not: null as any },
          status: { not: 'CANCELLED' as any }
        },
        _sum: {
          totalAmount: true,
          couponDiscount: true
        },
        _count: {
          id: true
        }
      });

      // Map stats back to coupon objects
      return coupons.map(c => {
        const stats = orderStats.find((s: any) => s.couponId === c.id);
        return {
          ...c,
          revenue: Number(stats?._sum.totalAmount || 0),
          totalDiscount: Number((stats as any)?._sum.couponDiscount || 0),
          usageCount: stats?._count.id || 0,
          avgOrder: stats?._count.id ? Number(stats._sum.totalAmount || 0) / stats._count.id : 0
        };
      }).filter(c => c.usageCount > 0 || c.usedCount > 0);
    } catch (err: any) {
      if (err.code === 'P2021') return [];
      throw err;
    }
  },

  // ── Loyalty Tiers Engine ───────────────────────────────────────────────────

  async getLoyaltyTiers(shopId: string): Promise<any[]> {
    try {
      return await (prisma as any).loyaltyTier.findMany({
        where: { shopId },
        orderBy: { minPoints: 'asc' }
      });
    } catch { return []; }
  },

  async saveLoyaltyTier(shopId: string, data: any): Promise<any> {
    if (data.id) {
      return await (prisma as any).loyaltyTier.update({
        where: { id: data.id, shopId },
        data: { name: data.name, minPoints: Number(data.minPoints), discountRate: Number(data.discountRate), badgeColor: data.badgeColor }
      });
    }
    return await (prisma as any).loyaltyTier.create({
      data: { shopId, name: data.name, minPoints: Number(data.minPoints), discountRate: Number(data.discountRate), badgeColor: data.badgeColor }
    });
  },

  async deleteLoyaltyTier(shopId: string, id: string): Promise<void> {
    await (prisma as any).loyaltyTier.delete({ where: { id, shopId } });
  },

  async getCustomerTier(shopId: string, totalPurchases: number): Promise<any | null> {
    try {
      // Find the highest tier they qualify for based on lifetime spend
      const tiers = await (prisma as any).loyaltyTier.findMany({
        where: { shopId, minPoints: { lte: totalPurchases } },
        orderBy: { minPoints: 'desc' },
        take: 1
      });
      return tiers.length > 0 ? tiers[0] : null;
    } catch { return null; }
  }
};
