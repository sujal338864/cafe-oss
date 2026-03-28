const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: 'postgres://postgres.kxxqgsqylqchxofpquwq:ShopOS@123456789%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' });
  await client.connect();
  const res = await client.query('SELECT "invoiceNumber", "status" FROM "Order" ORDER BY "createdAt" DESC LIMIT 3');
  console.log('PG Raw response:', res.rows);
  await client.end();
}

test().catch(console.error);
