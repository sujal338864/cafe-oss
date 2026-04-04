"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Use direct URL to bypass pgbouncer
const prisma = new client_1.PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});
async function main() {
    console.log('🧹 Clearing existing data...');
    // Delete in correct order (foreign keys)
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.stockHistory.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.shop.deleteMany({});
    console.log('✅ All data cleared');
    // Create YOUR shop with YOUR details
    console.log('🏪 Creating your shop...');
    const passwordHash = await bcryptjs_1.default.hash('admin123', 12);
    const shop = await prisma.shop.create({
        data: {
            name: 'My Shop', // ← CHANGE THIS
            ownerName: 'Shop Owner', // ← CHANGE THIS
            phone: '9999999999', // ← CHANGE THIS
            email: 'admin@myshop.com', // ← CHANGE THIS (this is your login email)
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            plan: 'PRO',
            users: {
                create: {
                    name: 'Shop Owner', // ← CHANGE THIS
                    email: 'admin@myshop.com', // ← CHANGE THIS
                    passwordHash,
                    role: 'ADMIN',
                }
            }
        },
        include: { users: true }
    });
    console.log(`✅ Shop created: ${shop.name}`);
    console.log(`📧 Login email: ${shop.email}`);
    console.log(`🔑 Password: admin123`);
    console.log(`\n⚠️  Change your password after first login!`);
    console.log(`\n🎉 Done! Your shop is ready with zero demo data.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
// import { PrismaClient } from '@prisma/client';
// import bcrypt from 'bcryptjs';
// // Use direct URL for seeding (bypasses pgbouncer pooler)
// const prisma = new PrismaClient({
//   datasources: {
//     db: {
//       url: process.env.DIRECT_URL || process.env.DATABASE_URL,
//     },
//   },
// });
// async function main() {
//   console.log('🌱 Seeding Shop OS demo data...');
//   // Shop + Admin
//   const passwordHash = await bcrypt.hash('admin123', 12);
//   const shop = await prisma.shop.upsert({
//     where: { email: 'admin@kiranaking.com' },
//     update: {},
//     create: {
//       name: 'Kirana King Store',
//       ownerName: 'Kiran Mehta',
//       phone: '9876543210',
//       email: 'admin@kiranaking.com',
//       gstNumber: '22AAAAA0000A1Z5',
//       address: '123 MG Road, Vadodara, Gujarat 390001',
//       plan: 'PRO',
//       users: {
//         create: {
//           name: 'Kiran Mehta',
//           email: 'admin@kiranaking.com',
//           passwordHash,
//           role: 'ADMIN',
//         }
//       }
//     },
//     include: { users: true }
//   });
//   console.log('✅ Shop created:', shop.name);
//   // Categories — sequential to avoid pool timeout
//   const categoryNames = ['Grains', 'Pulses', 'Oils', 'Beverages', 'Essentials', 'Snacks'];
//   const catMap: Record<string, string> = {};
//   for (const name of categoryNames) {
//     const cat = await prisma.category.upsert({
//       where: { shopId_name: { shopId: shop.id, name } },
//       update: {},
//       create: { shopId: shop.id, name }
//     });
//     catMap[name] = cat.id;
//   }
//   console.log('✅ Categories seeded:', categoryNames.length);
//   // Products — sequential
//   const productData = [
//     { name: 'Basmati Rice 5kg',  sku: 'PRD-001', categoryId: catMap['Grains'],     costPrice: 180, sellingPrice: 320, stock: 45,  lowStockAlert: 10, taxRate: 5  },
//     { name: 'Toor Dal 1kg',      sku: 'PRD-002', categoryId: catMap['Pulses'],     costPrice: 85,  sellingPrice: 120, stock: 120, lowStockAlert: 20, taxRate: 5  },
//     { name: 'Sunflower Oil 1L',  sku: 'PRD-003', categoryId: catMap['Oils'],       costPrice: 140, sellingPrice: 185, stock: 60,  lowStockAlert: 10, taxRate: 12 },
//     { name: 'Wheat Flour 10kg',  sku: 'PRD-004', categoryId: catMap['Grains'],     costPrice: 280, sellingPrice: 380, stock: 30,  lowStockAlert: 15, taxRate: 0  },
//     { name: 'Sugar 1kg',         sku: 'PRD-005', categoryId: catMap['Essentials'], costPrice: 38,  sellingPrice: 52,  stock: 200, lowStockAlert: 30, taxRate: 5  },
//     { name: 'Mustard Oil 500ml', sku: 'PRD-006', categoryId: catMap['Oils'],       costPrice: 75,  sellingPrice: 105, stock: 4,   lowStockAlert: 15, taxRate: 12 },
//     { name: 'Masoor Dal 500g',   sku: 'PRD-007', categoryId: catMap['Pulses'],     costPrice: 45,  sellingPrice: 68,  stock: 7,   lowStockAlert: 20, taxRate: 5  },
//     { name: 'Green Tea 100g',    sku: 'PRD-008', categoryId: catMap['Beverages'],  costPrice: 85,  sellingPrice: 145, stock: 34,  lowStockAlert: 10, taxRate: 12 },
//     { name: 'Coconut Oil 1L',    sku: 'PRD-009', categoryId: catMap['Oils'],       costPrice: 160, sellingPrice: 220, stock: 3,   lowStockAlert: 10, taxRate: 12 },
//     { name: 'Moong Dal 1kg',     sku: 'PRD-010', categoryId: catMap['Pulses'],     costPrice: 95,  sellingPrice: 135, stock: 55,  lowStockAlert: 15, taxRate: 5  },
//     { name: 'Biscuits Parle-G',  sku: 'PRD-011', categoryId: catMap['Snacks'],     costPrice: 5,   sellingPrice: 10,  stock: 500, lowStockAlert: 50, taxRate: 12 },
//     { name: 'Instant Noodles',   sku: 'PRD-012', categoryId: catMap['Snacks'],     costPrice: 12,  sellingPrice: 20,  stock: 200, lowStockAlert: 30, taxRate: 12 },
//   ];
//   for (const p of productData) {
//     await prisma.product.upsert({
//       where: { shopId_sku: { shopId: shop.id, sku: p.sku } },
//       update: {},
//       create: { shopId: shop.id, ...p }
//     });
//   }
//   console.log('✅ Products seeded:', productData.length);
//   // Customers — sequential
//   const customerData = [
//     { name: 'Rajan Patel',   phone: '9876543210', email: 'rajan@gmail.com',  totalPurchases: 48200, outstandingBalance: 0    },
//     { name: 'Sunita Sharma', phone: '9823456781', email: 'sunita@yahoo.com', totalPurchases: 32500, outstandingBalance: 1200 },
//     { name: 'Mohit Gupta',   phone: '9901234567', email: 'mohit@gmail.com',  totalPurchases: 28900, outstandingBalance: 0    },
//     { name: 'Priya Joshi',   phone: '9845678901', email: 'priya@gmail.com',  totalPurchases: 21600, outstandingBalance: 3400 },
//     { name: 'Amit Singh',    phone: '9812345678', email: 'amit@gmail.com',   totalPurchases: 15800, outstandingBalance: 0    },
//   ];
//   const customers = [];
//   for (const c of customerData) {
//     const customer = await prisma.customer.create({ data: { shopId: shop.id, ...c } });
//     customers.push(customer);
//   }
//   console.log('✅ Customers seeded:', customers.length);
//   // Suppliers — sequential
//   const supplierData = [
//     { name: 'ABC Traders',       phone: '9111222333', email: 'abc@traders.com'  },
//     { name: 'Gujarat Wholesale', phone: '9222333444', email: 'gw@wholesale.com' },
//     { name: 'Mumbai Food Dist.', phone: '9333444555', email: 'mfd@dist.com'     },
//   ];
//   for (const s of supplierData) {
//     await prisma.supplier.create({ data: { shopId: shop.id, ...s } });
//   }
//   console.log('✅ Suppliers seeded:', supplierData.length);
//   // Orders — seed 6 months of data
//   const user = shop.users[0];
//   const prods = await prisma.product.findMany({ where: { shopId: shop.id } });
//   const methods = ['CASH', 'UPI', 'CARD'] as const;
//   let orderCount = 0;
//   for (let daysAgo = 180; daysAgo >= 0; daysAgo -= Math.floor(Math.random() * 3 + 1)) {
//     const date = new Date();
//     date.setDate(date.getDate() - daysAgo);
//     const numOrders = Math.floor(Math.random() * 5 + 1);
//     for (let o = 0; o < numOrders; o++) {
//       const prod = prods[Math.floor(Math.random() * prods.length)];
//       const qty = Math.floor(Math.random() * 5 + 1);
//       const subtotal = Number(prod.sellingPrice) * qty;
//       const tax = subtotal * (Number(prod.taxRate) / 100);
//       const total = subtotal + tax;
//       orderCount++;
//       await prisma.order.create({
//         data: {
//           shopId: shop.id,
//           userId: user.id,
//           customerId: Math.random() > 0.5 ? customers[Math.floor(Math.random() * customers.length)].id : null,
//           invoiceNumber: `INV-${String(orderCount).padStart(5, '0')}`,
//           subtotal,
//           taxAmount: tax,
//           totalAmount: total,
//           paidAmount: total,
//           paymentMethod: methods[Math.floor(Math.random() * methods.length)],
//           createdAt: date,
//           items: {
//             create: [{
//               productId: prod.id,
//               name: prod.name,
//               quantity: qty,
//               costPrice: prod.costPrice,
//               unitPrice: prod.sellingPrice,
//               taxRate: prod.taxRate,
//               discount: 0,
//               total,
//             }]
//           }
//         }
//       });
//     }
//   }
//   console.log('✅ Orders seeded:', orderCount);
//   // Expenses — sequential
//   for (let m = 5; m >= 0; m--) {
//     const date = new Date();
//     date.setMonth(date.getMonth() - m);
//     await prisma.expense.create({ data: { shopId: shop.id, category: 'RENT',        amount: 15000, description: 'Monthly shop rent',   date } });
//     await prisma.expense.create({ data: { shopId: shop.id, category: 'ELECTRICITY', amount: 3200,  description: 'Electricity bill',     date } });
//     await prisma.expense.create({ data: { shopId: shop.id, category: 'SALARY',      amount: 18000, description: 'Staff salaries',       date } });
//     await prisma.expense.create({ data: { shopId: shop.id, category: 'TRANSPORT',   amount: 2400,  description: 'Delivery & transport', date } });
//   }
//   console.log('✅ Expenses seeded');
//   console.log('\n🎉 All done! Demo data loaded successfully.');
//   console.log('📧 Login: admin@kiranaking.com');
//   console.log('🔑 Password: admin123');
// }
// main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map