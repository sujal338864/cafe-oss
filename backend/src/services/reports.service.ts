import { prisma } from '../common/prisma';
import { AnalyticsService } from './analytics.service';
import { logger } from '../lib/logger';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';

export interface ReportData {
  period: 'daily' | 'weekly' | 'monthly';
  date: string;
  metrics: {
    revenue: number;
    orders: number;
    aov: number;
    profit: number;
  };
  trends?: {
    revenue: number;
    orders: number;
  };
  topItems: Array<{ name: string; quantity: number }>;
  plan: string;
  shopName: string;
}

/**
 * Reports Service
 * Handles generation of PDF and CSV business summaries.
 */
export const ReportsService = {
  /**
   * Generate Report Data (Shared for UI & Downloads)
   */
  generateReport: async (shopId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<ReportData> => {
    try {
      const now = new Date();
      let startDate = new Date();

      if (period === 'daily') startDate.setHours(0, 0, 0, 0);
      else if (period === 'weekly') startDate.setDate(now.getDate() - 7);
      else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);

      // 1. Core Metrics
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true, plan: true } });
      const orders = await prisma.order.findMany({
        where: { shopId, createdAt: { gte: startDate }, status: { not: 'CANCELLED' as any } },
        include: { items: true }
      });

      const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const orderCount = orders.length;
      const aov = orderCount > 0 ? revenue / orderCount : 0;

      // 2. Profit Calculation
      let totalCost = 0;
      orders.forEach(o => {
        o.items.forEach(i => {
          totalCost += Number(i.costPrice) * i.quantity;
        });
      });
      const profit = revenue - totalCost;

      // 3. Top Items
      const itemMap: Record<string, number> = {};
      orders.forEach(o => {
        o.items.forEach(i => {
          i.quantity > 0 && (itemMap[i.name] = (itemMap[i.name] || 0) + i.quantity);
        });
      });
      const topItems = Object.entries(itemMap)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // 4. Trends (PRO check)
      let trends;
      if (shop?.plan !== 'STARTER') {
        const proData = await AnalyticsService.getProInsights(shopId);
        trends = proData?.trends;
      }

      return {
        period,
        date: now.toISOString().split('T')[0],
        metrics: { revenue, orders: orderCount, aov, profit },
        trends,
        topItems,
        plan: shop?.plan || 'STARTER',
        shopName: shop?.name || 'Your Shop'
      };
    } catch (error: any) {
      logger.error(`[REPORT-SERVICE] Generation failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Generate PDF Report Buffer
   */
  generatePDF: async (shopId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<Buffer> => {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await ReportsService.generateReport(shopId, period);
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // HEADER
        doc.fillColor('#7c3aed').fontSize(24).font('Helvetica-Bold').text('ShopOS', { continued: true });
        doc.fillColor('#3b82f6').text(' Reports');
        doc.moveDown(0.2);
        doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('THE INTELLIGENT SAAS FOR MODERN COMMERCE');
        
        doc.moveDown(2);
        doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(`${data.period.toUpperCase()} PERFORMANCE SUMMARY`);
        doc.fontSize(12).font('Helvetica').text(`Business: ${data.shopName}`);
        doc.text(`Date Prepared: ${data.date}`);
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
        doc.moveDown(2);

        // KPI BOXES (SIMULATED)
        doc.fontSize(12).fillColor('#64748b').text('CORE METRICS', { characterSpacing: 1 });
        doc.moveDown();
        
        const startY = doc.y;
        doc.fillColor('#0f172a').fontSize(10).text('REVENUE', 50, startY);
        doc.fontSize(16).font('Helvetica-Bold').text(`₹${data.metrics.revenue.toLocaleString()}`, 50, startY + 15);
        
        doc.fontSize(10).font('Helvetica').text('ORDERS', 200, startY);
        doc.fontSize(16).font('Helvetica-Bold').text(`${data.metrics.orders}`, 200, startY + 15);
        
        doc.fontSize(10).font('Helvetica').text('NET PROFIT', 350, startY);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#10b981').text(`₹${data.metrics.profit.toLocaleString()}`, 350, startY + 15);

        doc.moveDown(3);
        doc.fillColor('#0f172a').moveTo(50, doc.y).lineTo(550, doc.y).stroke('#f1f5f9');
        doc.moveDown();

        // TOP ITEMS TABLE
        doc.fontSize(12).fillColor('#64748b').font('Helvetica').text('TOP SELLING INVENTORY');
        doc.moveDown();
        
        data.topItems.forEach((item, i) => {
           doc.fillColor('#0f172a').fontSize(11).text(`${i+1}. ${item.name}`, 50, doc.y, { continued: true });
           doc.text(` - ${item.quantity} units sold`, { align: 'right' });
           doc.moveDown(0.5);
        });

        // FOOTER
        doc.fontSize(8).fillColor('#94a3b8').text(`ShopOS Analysis Engine - ${data.plan} Tier - Shop ID: ${shopId}`, 50, 750, { align: 'center' });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Generate CSV Report Buffer
   */
  generateCSV: async (shopId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<string> => {
    try {
      const now = new Date();
      let startDate = new Date();
      if (period === 'daily') startDate.setHours(0, 0, 0, 0);
      else if (period === 'weekly') startDate.setDate(now.getDate() - 7);
      else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);

      const orders = await prisma.order.findMany({
        where: { shopId, createdAt: { gte: startDate }, status: { not: 'CANCELLED' as any } },
        include: { customer: { select: { name: true } }, items: true }
      });

      const csvData = orders.map(o => ({
        Invoice: o.invoiceNumber,
        Date: o.createdAt.toISOString().split('T')[0],
        Customer: o.customer?.name || 'Guest',
        Items: o.items.map(i => `${i.name}(${i.quantity})`).join('; '),
        Amount: o.totalAmount,
        Status: o.paymentStatus,
        Method: o.paymentMethod
      }));

      return stringify(csvData, { header: true });
    } catch (e: any) {
      logger.error(`[REPORT-SERVICE] CSV Generation failed: ${e.message}`);
      throw e;
    }
  }
};
