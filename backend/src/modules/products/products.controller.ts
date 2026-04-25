import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as productService from './products.service';
import { deleteCache } from '../../common/cache';

export const getProducts = async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', search = '', category, lowStock, available, mode } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, parseInt(limit as string) || 20);
  const skip = (pageNum - 1) * limitNum;

  const cacheKey = `products:${req.user!.shopId}:${pageNum}:${limitNum}:${search}:${category}:${lowStock}:${available}`;

  // 1. Try Cache
  try {
    const { getCache, setCache } = await import('../../common/cache');
    const cached = await getCache<any>(cacheKey);
    if (cached) return res.json(cached);
  } catch (e) { /* Silent fail to DB */ }

  const { products, total } = await productService.getProducts(req.user!.shopId, {
    skip,
    take: limitNum,
    search: search as string,
    category: category as string,
    lowStock: lowStock === 'true',
    available: available !== undefined ? available === 'true' : undefined,
    mode: mode as any
  });

  const response = {
    products,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };

  // 2. Set Cache (30s)
  try {
    const { setCache } = await import('../../common/cache');
    await setCache(cacheKey, response, 30);
  } catch (e) { /* Silent fail */ }

  res.json(response);
};

export const getProductById = async (req: AuthRequest, res: Response) => {
  const product = await productService.getProductById(req.params.id, req.user!.shopId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  const data = req.body;

  if (data.sku) {
    const existing = await productService.getProductBySku(req.user!.shopId, data.sku);
    if (existing) {
      return res.status(400).json({ error: 'SKU already exists' });
    }
  }

  const product = await productService.createProduct(req.user!.shopId, data);
  await deleteCache(`menu:${req.user!.shopId}`);
  res.status(201).json(product);
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  const product = await productService.getProductById(req.params.id, req.user!.shopId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const updated = await productService.updateProduct(req.params.id, req.body);
  await deleteCache(`menu:${req.user!.shopId}`);
  res.json(updated);
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const product = await productService.getProductById(req.params.id, req.user!.shopId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await productService.softDeleteProduct(req.params.id);
  await deleteCache(`menu:${req.user!.shopId}`);
  res.json({ success: true, message: 'Product deleted' });
};

export const getStockHistory = async (req: AuthRequest, res: Response) => {
  const { limit = '50' } = req.query;

  const product = await productService.getProductById(req.params.id, req.user!.shopId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const history = await productService.getStockHistory(req.params.id, parseInt(limit as string));
  res.json(history);
};

export const adjustStock = async (req: AuthRequest, res: Response) => {
  const { quantity, note } = req.body;

  if (!quantity || typeof quantity !== 'number') {
    return res.status(400).json({ error: 'Quantity is required and must be a number' });
  }

  const product = await productService.getProductById(req.params.id, req.user!.shopId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const updated = await productService.adjustStock(req.params.id, quantity, note);
  res.json(updated);
};
