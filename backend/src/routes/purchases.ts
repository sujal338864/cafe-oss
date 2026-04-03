import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest, tenantContext } from '../middleware/auth';

const router = Router();

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  billNumber: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    costPrice: z.number().positive()
  })).min(1, 'At least one item is required'),
  paidAmount: z.number().min(0).default(0),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'UNPAID']).default('PAID'),
  notes: z.string().optional()
});

/**
 * POST /api/purchases
 * Create purchase order and auto-increment stock
 */
router.post(
  '/',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(purchaseSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { supplierId, billNumber, purchaseDate, items, paidAmount, paymentStatus, notes } = req.body;

    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, shopId: req.shopId! }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.costPrice * item.quantity;
    }

    // Create purchase with items in transaction
    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          shopId: req.shopId!,
          supplierId,
          billNumber: billNumber || `PO-${Date.now()}`,
          totalAmount,
          paidAmount,
          paymentStatus,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          notes,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.costPrice * item.quantity
            }))
          }
        },
        include: { items: true, supplier: true }
      });

      // Increment stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.quantity,
            note: `Purchase: ${newPurchase.billNumber}`
          }
        });
      }

      // Update supplier outstanding balance if not fully paid
      if (paymentStatus !== 'PAID') {
        const outstanding = totalAmount - paidAmount;
        await tx.supplier.update({
          where: { id: supplierId },
          data: { outstandingBalance: { increment: outstanding } }
        });
      }

      return newPurchase;
    }, { timeout: 15000 });

    res.status(201).json(purchase);
  })
);

/**
 * GET /api/purchases
 */
router.get(
  '/',
  authenticate as any,
  tenantContext,
  asyncHandler(async (req: AuthRequest, res) => {
    const { page = '1', limit = '20', supplierId, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shopId: req.shopId!,
      ...(supplierId && { supplierId: supplierId as string }),
      ...(startDate && endDate && {
        purchaseDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      })
    };

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limitNum,
        include: { items: true, supplier: true },
        orderBy: { purchaseDate: 'desc' }
      }),
      prisma.purchase.count({ where })
    ]);

    res.json({
      purchases,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  })
);

/**
 * GET /api/purchases/:id
 */
router.get(
  '/:id',
  authenticate as any,
  tenantContext,
  asyncHandler(async (req: AuthRequest, res) => {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, shopId: req.shopId! },
      include: { items: true, supplier: true }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json(purchase);
  })
);

export default router;
