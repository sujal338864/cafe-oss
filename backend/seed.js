/**
 * seed.js — Complete seed script. Safe to re-run (cleans up first).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const SHOP_EMAIL = 'admin@cafeosz.com';

async function main() {
  console.log('\n=== Seeding Database ===\n');

  // 1. Check if shop already exists
  const existing = await prisma.shop.findFirst({ where: { email: SHOP_EMAIL } });
  if (existing) {
    console.log('⚠️  Shop already exists. Skipping seed to prevent data loss.');
    return;
  }

  // 2. Create shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Cafe OS',
      ownerName: 'Admin',
      phone: '9876543210',
      email: SHOP_EMAIL,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      plan: 'STARTER',
      isActive: true,
    }
  });
  console.log('✅ Shop created:', shop.name);

  // 3. Create admin user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      email: SHOP_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      shopId: shop.id,
    }
  });
  console.log('✅ User created:', user.email);

  // 4. Create products (no `category` string - only categoryId which is optional)
  const products = [
    { name: 'Espresso',            costPrice: 40,  sellingPrice: 120, stock: 100 },
    { name: 'Cappuccino',          costPrice: 60,  sellingPrice: 180, stock: 85  },
    { name: 'Latte',               costPrice: 65,  sellingPrice: 190, stock: 70  },
    { name: 'Mocha',               costPrice: 75,  sellingPrice: 220, stock: 60  },
    { name: 'Americano',           costPrice: 45,  sellingPrice: 130, stock: 95  },
    { name: 'Iced Coffee',         costPrice: 50,  sellingPrice: 160, stock: 120 },
    { name: 'Frappe',              costPrice: 80,  sellingPrice: 240, stock: 50  },
    { name: 'Green Tea',           costPrice: 25,  sellingPrice: 80,  stock: 150 },
    { name: 'Masala Chai',         costPrice: 20,  sellingPrice: 60,  stock: 200 },
    { name: 'Croissant',           costPrice: 40,  sellingPrice: 110, stock: 30  },
    { name: 'Blueberry Muffin',    costPrice: 45,  sellingPrice: 120, stock: 40  },
    { name: 'Chocolate Cookie',    costPrice: 25,  sellingPrice: 60,  stock: 80  },
    { name: 'Sandwich',            costPrice: 60,  sellingPrice: 150, stock: 25  },
    { name: 'Cheesecake Slice',    costPrice: 90,  sellingPrice: 250, stock: 15  },
  ];

  await prisma.product.createMany({
    data: products.map(p => ({
      shopId: shop.id,
      name: p.name,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      sku: 'SKU-' + p.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000),
      lowStockAlert: 10,
      taxRate: 5,
      isActive: true,
    }))
  });

  const dbProducts = await prisma.product.findMany({ where: { shopId: shop.id } });
  console.log(`✅ ${dbProducts.length} products created`);

  // 5. Create 60 orders over the last 14 days
  const now = new Date();
  const paymentMethods = ['UPI', 'CASH', 'CARD'];
  let totalRev = 0;
  let orderCount = 0;

  for (let i = 0; i < 60; i++) {
    const date = new Date();
    date.setDate(now.getDate() - Math.floor(Math.random() * 14));
    date.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0);

    const isCancelled = Math.random() > 0.95;
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let subtotal = 0;

    for (let j = 0; j < numItems; j++) {
      const p = dbProducts[Math.floor(Math.random() * dbProducts.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Number(p.sellingPrice);
      const costPrice = Number(p.costPrice);
      const total = unitPrice * qty;
      subtotal += total;
      items.push({ productId: p.id, name: p.name, quantity: qty, unitPrice, costPrice, taxRate: 5, discount: 0, total });
    }

    await prisma.order.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        invoiceNumber: `INV-${Date.now()}-${i}`,
        subtotal,
        totalAmount: subtotal,
        taxAmount: subtotal * 0.05,
        discountAmount: 0,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        paymentStatus: 'PAID',
        status: isCancelled ? 'CANCELLED' : 'COMPLETED',
        createdAt: date,
        items: { create: items }
      }
    });

    for (const item of items) {
      await prisma.stockHistory.create({
        data: { shopId: shop.id, productId: item.productId, type: 'SALE', quantity: -item.quantity, note: 'Seeded' }
      });
    }

    if (!isCancelled) totalRev += subtotal;
    orderCount++;
  }

  console.log(`✅ ${orderCount} orders created. Total revenue: ₹${totalRev.toFixed(0)}`);

  // 6. Create an expense
  await prisma.expense.create({
    data: {
      shopId: shop.id,
      amount: 4500,
      category: 'ELECTRICITY',
      description: 'Monthly electric bill',
      date: new Date(now.getTime() - 2 * 86400000)
    }
  });

  console.log('\n✅ All done!');
  console.log('🔑 Login: admin@cafeosz.com / password123\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
