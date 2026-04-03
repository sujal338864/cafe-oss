import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as supplierService from './suppliers.service';

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', search = '' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, parseInt(limit as string) || 20);
  const skip = (pageNum - 1) * limitNum;

  const { suppliers, total } = await supplierService.getSuppliers(req.shopId!, {
    skip,
    take: limitNum,
    search: search as string
  });

  res.json({
    suppliers,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
  });
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
  const supplier = await supplierService.createSupplier(req.shopId!, req.body);
  res.status(201).json(supplier);
};

export const getSupplierById = async (req: AuthRequest, res: Response) => {
  const supplier = await supplierService.getSupplierById(req.params.id, req.shopId!);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }
  res.json(supplier);
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
  const supplier = await supplierService.getSupplierById(req.params.id, req.shopId!);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const updated = await supplierService.updateSupplier(req.params.id, req.body);
  res.json(updated);
};

export const getSupplierPurchases = async (req: AuthRequest, res: Response) => {
  const purchases = await supplierService.getSupplierPurchases(req.params.id, req.shopId!);
  res.json(purchases);
};
