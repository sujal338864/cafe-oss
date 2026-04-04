const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT "id", "invoiceNumber", "status", "paymentStatus" FROM "Order" ORDER BY "createdAt" DESC LIMIT 5');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

run().catch(console.error);
