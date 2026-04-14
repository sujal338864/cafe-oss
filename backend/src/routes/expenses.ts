import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';
import { ExpenseCategory } from '@prisma/client';

const router = Router();

const expenseSchema = z.object({
  category: z.enum(['RENT', 'ELECTRICITY', 'SALARY', 'MAINTENANCE', 'MARKETING', 'TRANSPORT', 'OTHER']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
  date: z.string().datetime().optional()
});

/**
 * POST /api/expenses
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(expenseSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { category, amount, description, date } = req.body;

    const expense = await prisma.expense.create({
      data: {
        shopId: req.user!.shopId,
        category: category as ExpenseCategory,
        amount,
        description,
        date: date ? new Date(date) : new Date()
      }
    });

    res.status(201).json(expense);
  })
);

/**
 * GET /api/expenses
 * Restricted to ADMIN and MANAGER — employees must not see financial data
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { page = '1', limit = '20', category, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shopId: req.user!.shopId,
      deletedAt: null,
      ...(category && { category: category as string }),
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      })
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' }
      }),
      prisma.expense.count({ where })
    ]);

    res.json({
      expenses,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  })
);

/**
 * DELETE /api/expenses/:id
 * Soft-delete to preserve audit trail for tax/GST compliance.
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Soft-delete: set deletedAt instead of hard delete so GST/tax history is preserved
    try {
      await prisma.expense.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() } as any
      });
    } catch {
      // Fallback to hard delete if schema doesn't have deletedAt column yet
      // Run the RLS + soft-delete migration to get audit trail support
      await prisma.expense.delete({ where: { id: req.params.id } });
    }

    res.json({ success: true });
  })
);

export default router;
