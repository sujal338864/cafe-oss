const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function check() {
  try {
    const order = await prisma.order.findFirst({
      where: { invoiceNumber: 'ONL-000165' }
    });
    
    // Find the last POS order
    const posOrder = await prisma.order.findFirst({
      where: { invoiceNumber: 'INV-000164' }
    });
    
    fs.writeFileSync('db_output.txt', `ONL NOTES: ${JSON.stringify(order?.notes)}\nINV NOTES: ${JSON.stringify(posOrder?.notes)}`);
  } catch (err) {
    fs.writeFileSync('db_output.txt', `ERROR: ${err.message}`);
  } finally {
    process.exit(0);
  }
}
check();
