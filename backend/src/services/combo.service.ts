import { prisma } from '../common/prisma';
import { logger } from '../lib/logger';

export const ComboService = {
  /**
   * Create a new combo with child items
   */
  createCombo: async (shopId: string, data: any) => {
    const { name, description, imageUrl, fixedPrice, items, startTime, endTime, organizationId } = data;

    return await prisma.combo.create({
      data: {
        shopId,
        organizationId,
        name,
        description,
        imageUrl,
        fixedPrice,
        startTime,
        endTime,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        }
      },
      include: { items: { include: { product: true } } }
    });
  },

  /**
   * Get all combos for a shop, with availability check
   */
  getCombos: async (shopId: string) => {
    const combos = await prisma.combo.findMany({
      where: { shopId, isActive: true },
      include: { 
        items: { 
          include: { 
            product: { 
              select: { id: true, name: true, stock: true, isAvailable: true, isActive: true } 
            } 
          } 
        } 
      },
      orderBy: { name: 'asc' }
    });

    // Dynamic availability check: if any child is unavailable/out of stock, combo is unavailable
    return combos.map(combo => {
      const isAvailable = combo.items.every(item => 
        item.product.isActive && 
        item.product.isAvailable && 
        item.product.stock >= item.quantity
      );
      return { ...combo, isAvailable };
    });
  },

  /**
   * Deduct stock for all items in a combo
   */
  deductComboStock: async (tx: any, shopId: string, comboId: string, quantity: number) => {
    const combo = await tx.combo.findUnique({
      where: { id: comboId },
      include: { items: true }
    });

    if (!combo) return;

    for (const item of combo.items) {
      const totalToDeduct = item.quantity * quantity;
      
      const affected = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock - ${totalToDeduct}
        WHERE id = ${item.productId} AND "shopId" = ${shopId} AND stock >= ${totalToDeduct}
      `;

      if (affected === 0) {
        logger.warn(`[COMBO_STOCK] Insufficient stock for component ${item.productId} in Combo ${comboId}`);
        // Optionally throw error to rollback transaction if strict mode enabled
      }
    }
  }
};
