import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as customerService from './customers.service';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', search = '' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, parseInt(limit as string) || 20);
  const skip = (pageNum - 1) * limitNum;

  const { customers, total } = await customerService.getCustomers(req.user!.shopId, {
    skip,
    take: limitNum,
    search: search as string
  });

  res.json({
    customers,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
  });
};

export const createCustomer = async (req: AuthRequest, res: Response) => {
  if (req.body.phone) {
    const existing = await customerService.getCustomerByPhone(req.user!.shopId, req.body.phone);
    if (existing) {
      return res.status(400).json({ error: 'Customer with this phone number already exists' });
    }
  }

  const customer = await customerService.createCustomer(req.user!.shopId, req.body);
  res.status(201).json(customer);
};

export const lookupCustomer = async (req: AuthRequest, res: Response) => {
  const { phone } = req.query;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'phone query param required' });
  }

  const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
  const customer = await customerService.lookupCustomer(req.user!.shopId, digits);

  if (!customer) {
    return res.status(404).json({ found: false, error: 'Customer not found' });
  }

  res.json({ found: true, customer });
};

export const getCustomerById = async (req: AuthRequest, res: Response) => {
  const customer = await customerService.getCustomerById(req.params.id, req.user!.shopId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(customer);
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  const customer = await customerService.getCustomerById(req.params.id, req.user!.shopId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const updated = await customerService.updateCustomer(req.params.id, req.body);
  res.json(updated);
};

export const getCustomerOrders = async (req: AuthRequest, res: Response) => {
  const orders = await customerService.getCustomerOrders(req.params.id, req.user!.shopId);
  res.json(orders);
};
