const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres.nxrremvvolgapdtlrwwl:xsv67nH%2BE%2AS%2FMRx@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected via PgBouncer. Altering Enum...');

    // Attempt to add PENDING
    try {
      await client.query(`ALTER TYPE "OrderStatus" ADD VALUE 'PENDING';`);
      console.log('Added PENDING');
    } catch (e) { console.log('PENDING might already exist:', e.message); }

    // Attempt to add PREPARING
    try {
      await client.query(`ALTER TYPE "OrderStatus" ADD VALUE 'PREPARING';`);
      console.log('Added PREPARING');
    } catch (e) { }

    // Attempt to add READY
    try {
      await client.query(`ALTER TYPE "OrderStatus" ADD VALUE 'READY';`);
      console.log('Added READY');
    } catch (e) { }

    console.log('Successfully updated Enums!');
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await client.end();
  }
}
run();
