// Unused imports removed


export interface PricingRule {
  name: string;
  startsAt: string; // "HH:mm" (24h format)
  endsAt: string;   // "HH:mm"
  discountPercent: number;
  categoryIds?: string[];
  productIds?: string[];
}

export interface PricingRulesConfig {
  rules: PricingRule[];
}

/**
 * Pricing Engine: Calculates dynamic discounts based on shop rules and current time.
 */
export function applyPricingRules(
  products: any[],
  shop: any
) {
  if (!shop.pricingEnabled || !shop.pricingRules) {
    return products.map(p => ({ ...p, originalPrice: Number(p.sellingPrice), discountedPrice: Number(p.sellingPrice), activeRule: null }));
  }

  const config = shop.pricingRules as unknown as PricingRulesConfig;
  if (!config.rules || !config.rules.length) {
    return products.map(p => ({ ...p, originalPrice: Number(p.sellingPrice), discountedPrice: Number(p.sellingPrice), activeRule: null }));
  }

  // Get current time in shop's timezone
  // Note: For simplicity, we use the server time's HH:mm
  // In a real app, use luxon/moment-timezone with shop.timezone
  const now = new Date();
  const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  // Find active rules
  const activeRules = config.rules.filter(rule => {
    return currentHHmm >= rule.startsAt && currentHHmm <= rule.endsAt;
  });

  return products.map(p => {
    const originalPrice = Number(p.sellingPrice);
    
    // Find best matching rule (Product specific first, then Category)
    const matchingRule = activeRules.find(r => 
      (r.productIds?.includes(p.id)) || 
      (r.categoryIds?.includes(p.categoryId)) ||
      (!r.productIds?.length && !r.categoryIds?.length) // Global rule if no filters
    );

    if (matchingRule) {
      const discountPercent = Math.min(Math.max(matchingRule.discountPercent, 0), 100);
      const discount = (originalPrice * discountPercent) / 100;
      const discountedPrice = Math.round(originalPrice - discount);
      return {
        ...p,
        originalPrice,
        discountedPrice,
        activeRule: matchingRule.name
      };
    }

    return {
      ...p,
      originalPrice,
      discountedPrice: originalPrice,
      activeRule: null
    };
  });
}
