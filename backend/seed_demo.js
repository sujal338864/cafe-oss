const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cafeosz.com';

  console.log(`--- Seeding Demo Data for ${email} ---`);

  try {
    // 1. Ensure User exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Admin User',
          email,
          passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LqGZC.9zWdAtMBN/z/f5.UoA.5Z7B.n8v1y.y', // "password123"
          plan: 'PRO',
          shopLimit: 5
        }
      });
      console.log('Created new Admin user.');
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: 'PRO', shopLimit: 5 }
      });
      console.log('Updated existing user to PRO.');
    }

    // 2. Create a Shop
    const shop = await prisma.shop.create({
      data: {
        name: 'The Premium Cafe',
        ownerName: 'Admin',
        phone: '9876543210',
        email: 'cafe1@demo.com',
        address: '123 Gourmet St',
        currency: 'INR',
        plan: 'PRO'
      }
    });
    console.log(`Created Shop: ${shop.name} (${shop.id})`);

    // 3. Link User to Shop
    await prisma.shopMember.upsert({
      where: { userId_shopId: { userId: user.id, shopId: shop.id } },
      update: { role: 'ADMIN' },
      create: { userId: user.id, shopId: shop.id, role: 'ADMIN' }
    });
    console.log('Linked user to shop as ADMIN.');

    // 4. Create Categories & Products
    const category = await prisma.category.create({
      data: { shopId: shop.id, name: 'Beverages', color: '#3b82f6' }
    });

    const products = await Promise.all([
      prisma.product.create({
        data: {
          shopId: shop.id, categoryId: category.id, name: 'Cappuccino',
          costPrice: 40, sellingPrice: 120, stock: 50, unit: 'cups'
        }
      }),
      prisma.product.create({
        data: {
          shopId: shop.id, categoryId: category.id, name: 'Blueberry Muffin',
          costPrice: 30, sellingPrice: 85, stock: 12, unit: 'pcs', lowStockAlert: 15
        }
      })
    ]);
    console.log('Added 2 products.');

    // 5. Create some Orders (Demo sales)
    for (let i = 0; i < 5; i++) {
      const total = 200 + (Math.random() * 500);
      await prisma.order.create({
        data: {
          shopId: shop.id,
          userId: user.id,
          invoiceNumber: `INV-${1000 + i}`,
          subtotal: total,
          totalAmount: total,
          paymentMethod: 'UPI',
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) // Spread over last 5 days
        }
      });
    }
    console.log('Generated 5 demo orders.');

    console.log('✅ SEEDING COMPLETE. Please refresh your dashboard!');

  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
