import { z } from 'zod';

export const createOrderSchema = z.object({
  customerId: z.string().nullable().optional(),
  discountAmount: z.number().nonnegative().optional().default(0),
  redeemPoints: z.number().int().nonnegative().optional().default(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  paymentStatus: z.enum(['PAID', 'UNPAID']),
  notes: z.string().max(255).nullable().optional(),
  couponCode: z.string().max(50).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().optional().nullable(),
    comboId: z.string().optional().nullable(),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    costPrice: z.number().nonnegative().optional(),
    unitPrice: z.number().nonnegative().optional(),
    taxRate: z.number().nonnegative().optional().default(0),
    discount: z.number().nonnegative().optional().default(0)
  })).min(1, 'At least one item is required')
    .refine(items => items.every(item => item.productId || item.comboId), {
      message: "Each item must have either a productId or a comboId"
    })
});
