import { prisma } from '../common/prisma';
import { logger } from '../lib/logger';

export const MenuSyncService = {
  
  /**
   * Create a background job for menu sync.
   */
  queueSyncJob: async (orgId: string, templateId: string, branchIds: string[], mode: string) => {
    // 1. Save job record to DB for audit
    const job = await (prisma as any).menuSyncJob.create({
      data: {
        organizationId: orgId,
        templateId,
        targetBranchIds: branchIds,
        mode,
        status: 'PENDING'
      }
    });

    try {
      // 2. Queue in BullMQ for async processing
      const { menuSyncQueue } = require('../jobs/queues');
      if (menuSyncQueue) {
        await menuSyncQueue.add('process-sync', {
          jobId: job.id,
          orgId,
          templateId,
          branchIds,
          mode
        });
      } else {
        logger.warn('[MenuSyncService] menuSyncQueue not found. Processing synchronously (not recommended).');
        // Fallback for dev if workers aren't ready
      }
    } catch (err: any) {
      logger.error(`[MenuSyncService] Failed to queue job: ${err.message}`);
      await (prisma as any).menuSyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: 'Failed to add to queue: ' + err.message }
      });
    }

    return job;
  },

  /**
   * The actual sync logic for a single branch.
   * Called by the worker or service.
   */
  syncToSingleBranch: async (branchId: string, template: any, mode: string) => {
    const items = Array.isArray(template.items) ? template.items : [];
    let updated = 0;
    let created = 0;
    let deactivated = 0;

    const templateProductNames = items.map(i => i.name);

    for (const item of items) {
      try {
        // 1. Resolve Category (Name-based reconciliation)
        let categoryId = undefined;
        if (item.categoryName) {
          const cat = await (prisma as any).category.upsert({
            where: { shopId_name: { shopId: branchId, name: item.categoryName } },
            create: { shopId: branchId, name: item.categoryName },
            update: {} 
          });
          categoryId = cat.id;
        }

        // 2. Find existing product by name or SKU
        const existing = await prisma.product.findFirst({
          where: { 
            shopId: branchId, 
            OR: [
              { name: item.name },
              ...(item.sku ? [{ sku: item.sku }] : [])
            ]
          }
        });

        if (existing) {
          // MODE: REPLACE or PRICE_ONLY or ADDITIVE (update anyway if it exists)
          if (mode === 'REPLACE' || mode === 'PRICE_ONLY' || mode === 'ADDITIVE') {
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                ...(mode === 'PRICE_ONLY' ? {
                  sellingPrice: item.sellingPrice
                } : {
                  // REPLACE or ADDITIVE (standard update)
                  sellingPrice: item.sellingPrice || existing.sellingPrice,
                  costPrice: item.costPrice || existing.costPrice,
                  taxRate: item.taxRate || existing.taxRate,
                  unit: item.unit || existing.unit,
                  description: item.description || existing.description,
                  categoryId: categoryId || existing.categoryId,
                  isActive: true // Force reactive
                })
              }
            });
            updated++;
          }
        } else {
          // Missing product
          if (mode !== 'PRICE_ONLY') {
            // Create in ADDITIVE or REPLACE mode
            await prisma.product.create({
              data: {
                shopId: branchId,
                name: item.name,
                sku: item.sku,
                costPrice: item.costPrice || 0,
                sellingPrice: item.sellingPrice || 0,
                taxRate: item.taxRate || 0,
                unit: item.unit || 'pcs',
                description: item.description,
                categoryId: categoryId,
                isActive: true,
                isAvailable: true
              }
            });
            created++;
          }
        }
      } catch (itemErr: any) {
        logger.error(`[MenuSync] Failed item "${item.name}" on branch ${branchId}: ${itemErr.message}`);
      }
    }

    // 3. Handle REPLACE Mode (Deactivate non-template items)
    if (mode === 'REPLACE') {
      const toDeactivate = await prisma.product.findMany({
        where: { 
          shopId: branchId, 
          name: { notIn: templateProductNames },
          isActive: true 
        },
        select: { id: true }
      });

      if (toDeactivate.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: toDeactivate.map(p => p.id) } },
          data: { isActive: false }
        });
        deactivated = toDeactivate.length;
      }
    }

    // --- 4. Combo Sync ---
    const combos = Array.isArray(template.combos) ? template.combos : [];
    for (const cTemplate of combos) {
      try {
        const existingCombo = await prisma.combo.findFirst({
          where: { shopId: branchId, name: cTemplate.name }
        });

        const comboData = {
          name: cTemplate.name,
          description: cTemplate.description,
          imageUrl: cTemplate.imageUrl,
          fixedPrice: cTemplate.fixedPrice,
          isActive: true,
          showInScanner: cTemplate.showInScanner ?? true,
          showInPOS: cTemplate.showInPOS ?? true,
        };

        if (existingCombo) {
          await prisma.combo.update({
            where: { id: existingCombo.id },
            data: comboData
          });
          
          // Refresh combo items
          if (Array.isArray(cTemplate.items)) {
            await prisma.comboItem.deleteMany({ where: { comboId: existingCombo.id } });
            for (const ci of cTemplate.items) {
              const targetProd = await prisma.product.findFirst({
                where: { shopId: branchId, name: ci.productName }
              });
              if (targetProd) {
                await prisma.comboItem.create({
                  data: { comboId: existingCombo.id, productId: targetProd.id, quantity: ci.quantity }
                });
              }
            }
          }
        } else {
          const newCombo = await prisma.combo.create({
            data: { ...comboData, shopId: branchId }
          });
          if (Array.isArray(cTemplate.items)) {
            for (const ci of cTemplate.items) {
              const targetProd = await prisma.product.findFirst({
                where: { shopId: branchId, name: ci.productName }
              });
              if (targetProd) {
                await prisma.comboItem.create({
                  data: { comboId: newCombo.id, productId: targetProd.id, quantity: ci.quantity }
                });
              }
            }
          }
        }
      } catch (comboErr: any) {
        logger.error(`[MenuSync] Failed combo "${cTemplate.name}" on branch ${branchId}: ${comboErr.message}`);
      }
    }

    return { created, updated, deactivated };
  }
};
