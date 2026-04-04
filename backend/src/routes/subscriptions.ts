import { Router } from 'express';
const router = Router();
router.get('/', (_req, res) => res.json({ plan: 'free', status: 'active' }));
export default router;
