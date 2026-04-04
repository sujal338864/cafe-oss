const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: 'postgres://postgres.nxrremvvolgapdtlrwwl:xsv67nH%2BE%2AS%2FMRx@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
  await client.connect();
  const res = await client.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public."OrderStatus"'::regtype;`);
  console.log('ENUMS:', res.rows.map(r => r.enumlabel));
  await client.end();
}

test().catch(console.error);
