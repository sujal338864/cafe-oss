const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  console.log('Restoring fully populated demo state for user...');
  
  // 1. Create fake shop
  const shop = await prisma.shop.create({
    data: {
      name: 'Cafe OS',
      ownerName: 'Admin',
      phone: '1234567890',
      email: 'admin@cafeosz.com',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      plan: 'STARTER',
      isActive: true,
    }
  });

  // 2. Create the admin user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@cafeosz.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      shopId: shop.id
    }
  });
  console.log('Admin user created:', user.email);

  // 3. Create products (no `category` string field - schema uses categoryId)
  const productsToCreate = [
    { name: 'Espresso', costPrice: 40, sellingPrice: 120, stock: 100 },
    { name: 'Cappuccino', costPrice: 60, sellingPrice: 180, stock: 85 },
    { name: 'Latte', costPrice: 65, sellingPrice: 190, stock: 70 },
    { name: 'Mocha', costPrice: 75, sellingPrice: 220, stock: 60 },
    { name: 'Americano', costPrice: 45, sellingPrice: 130, stock: 95 },
    { name: 'Iced Coffee', costPrice: 50, sellingPrice: 160, stock: 120 },
    { name: 'Frappe', costPrice: 80, sellingPrice: 240, stock: 50 },
    { name: 'Green Tea', costPrice: 25, sellingPrice: 80, stock: 150 },
    { name: 'Masala Chai', costPrice: 20, sellingPrice: 60, stock: 200 },
    { name: 'Croissant', costPrice: 40, sellingPrice: 110, stock: 30 },
    { name: 'Blueberry Muffin', costPrice: 45, sellingPrice: 120, stock: 40 },
    { name: 'Chocolate Chip Cookie', costPrice: 25, sellingPrice: 60, stock: 80 },
    { name: 'Sandwich', costPrice: 60, sellingPrice: 150, stock: 25 },
    { name: 'Cheesecake Slice', costPrice: 90, sellingPrice: 250, stock: 15 },
  ];

  await prisma.product.createMany({
    data: productsToCreate.map(p => ({
      ...p,
      shopId: shop.id,
      sku: 'SKU-' + p.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000),
      lowStockAlert: 10,
      taxRate: 5,
      isActive: true,
    }))
  });

  const shopProducts = await prisma.product.findMany({ where: { shopId: shop.id } });
  const now = new Date();

  // 4. Create orders over the last 14 days
  let totalRev = 0;
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(now.getDate() - daysAgo);
    const hour = Math.random() > 0.5 ? 18 + Math.floor(Math.random()*4) : 12 + Math.floor(Math.random()*3);
    date.setHours(hour, Math.floor(Math.random()*60), 0);

    const isCancelled = Math.random() > 0.95;
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let orderTotal = 0;

    for (let j = 0; j < numItems; j++) {
      const p = shopProducts[Math.floor(Math.random() * shopProducts.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Number(p.sellingPrice);
      const costPrice = Number(p.costPrice || (unitPrice * 0.4));
      const total = unitPrice * qty;
      orderTotal += total;
      items.push({
        productId: p.id,
        name: p.name,
        quantity: qty,
        unitPrice,
        costPrice,
        taxRate: Number(p.taxRate || 0),
        discount: 0,
        total,
      });
    }

    const token = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const paymentMethods = ['UPI', 'CASH', 'CARD'];

    await prisma.order.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        invoiceNumber: `INV-${date.getTime()}-${token}`,
        subtotal: orderTotal,
        totalAmount: orderTotal,
        taxAmount: orderTotal * 0.05,
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
        data: {
          shopId: shop.id,
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          note: 'Seeded Sale'
        }
      });
    }

    if (!isCancelled) totalRev += orderTotal;
  }

  // 5. Create an expense
  await prisma.expense.create({
    data: {
      shopId: shop.id,
      amount: 4500,
      category: 'ELECTRICITY',
      description: 'Monthly electric bill',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  console.log(`\n✅ Done! Seeded 14 products, 60 orders. Estimated revenue: ₹${totalRev.toFixed(0)}`);
  console.log(`\n🔑 Login: admin@cafeosz.com / password123`);
}

run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
