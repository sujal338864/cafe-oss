// import { Router } from 'express';
// import { prisma } from '../index';
// import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';

// const router = Router();

// /**
//  * GET /api/notifications
//  */
// router.get(
//   '/',
//   authenticate,
//   asyncHandler(async (req: AuthRequest, res) => {
//     const { page = '1', limit = '20', unread } = req.query;
//     const pageNum = Math.max(1, parseInt(page as string) || 1);
//     const limitNum = Math.min(100, parseInt(limit as string) || 20);
//     const skip = (pageNum - 1) * limitNum;

//     const where: any = {
//       shopId: req.user!.shopId,
//       ...(unread === 'true' && { isRead: false })
//     };

//     const [notifications, total] = await Promise.all([
//       prisma.notification.findMany({
//         where,
//         skip,
//         take: limitNum,
//         orderBy: { createdAt: 'desc' }
//       }),
//       prisma.notification.count({ where })
//     ]);

//     res.json({
//       notifications,
//       pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
//     });
//   })
// );

// /**
//  * PUT /api/notifications/:id/read
//  */
// router.put(
//   '/:id/read',
//   authenticate,
//   asyncHandler(async (req: AuthRequest, res) => {
//     const notification = await prisma.notification.findFirst({
//       where: { id: req.params.id, shopId: req.user!.shopId }
//     });

//     if (!notification) {
//       return res.status(404).json({ error: 'Notification not found' });
//     }

//     const updated = await prisma.notification.update({
//       where: { id: req.params.id },
//       data: { isRead: true }
//     });

//     res.json(updated);
//   })
// );

// /**
//  * PUT /api/notifications/read-all
//  */
// router.put(
//   '/read-all',
//   authenticate,
//   asyncHandler(async (req: AuthRequest, res) => {
//     await prisma.notification.updateMany({
//       where: { shopId: req.user!.shopId, isRead: false },
//       data: { isRead: true }
//     });

//     res.json({ success: true });
//   })
// );

// export default router;
