console.log('1. Starting Script');
const dotenv = require('dotenv');
dotenv.config();
console.log('2. Dotenv loaded');
const { PrismaClient } = require('@prisma/client');
console.log('3. Prisma required');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });
console.log('4. Prisma Instantiated');

async function test() {
  try {
    console.log('5. Inside Test');
    const count = await prisma.order.count();
    console.log('6. Total Orders in Database:', count);

    console.log('7. Executing Category Breakdown $queryRaw...');
    const categoryBreakdownRaw = await prisma.$queryRaw`
      SELECT c.name, SUM(oi.total) as revenue 
      FROM "Category" c 
      JOIN "Product" p ON p."categoryId" = c.id 
      JOIN "OrderItem" oi ON oi."productId" = p.id 
      JOIN "Order" o ON o.id = oi."orderId" 
      WHERE o."shopId" = 'd8bd17c9-c001-4d56-8351-2c73214083d1' AND o.status::text = 'COMPLETED' 
      GROUP BY c.name 
      ORDER BY revenue DESC
    `;
    console.log('8. Category Breakdown $queryRaw count:', categoryBreakdownRaw.length);

    console.log('9. Initializing OpenAI Client for Groq...');
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });

    console.log('10. Executing Groq Completion Request...');
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello!' }],
      model: 'llama3-8b-8192',
      max_tokens: 10,
    });

    console.log('11. Groq response:', chatCompletion.choices[0].message.content);
    process.exit(0);
  } catch (e) {
    console.error('Crashed inside test:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
