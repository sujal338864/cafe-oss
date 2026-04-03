import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as categoryService from './categories.service';
import { deleteCache } from '../../common/cache';

export const getCategories = async (req: AuthRequest, res: Response) => {
  const categories = await categoryService.getCategories(req.shopId!);
  res.json({ categories });
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, color } = req.body;

  const existing = await categoryService.getCategoryByName(req.shopId!, name);
  if (existing) {
    return res.status(400).json({ error: 'Category already exists' });
  }

  const category = await categoryService.createCategory(req.shopId!, { name, color });
  await deleteCache(`menu:${req.shopId!}`);
  res.status(201).json(category);
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.id, req.shopId!);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const updated = await categoryService.updateCategory(req.params.id, req.body);
  await deleteCache(`menu:${req.shopId!}`);
  res.json(updated);
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.id, req.shopId!);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  await categoryService.deleteCategory(req.params.id);
  await deleteCache(`menu:${req.shopId!}`);
  res.json({ success: true });
};
