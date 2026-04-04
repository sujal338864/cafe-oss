const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking active pg_stat_activity...');
    const queries = await prisma.$queryRaw`
      SELECT pid, query, state, wait_event_type, wait_event 
      FROM pg_stat_activity 
      WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
    `;
    
    console.log('\n--- ACTIVE QUERIES ---');
    console.log(JSON.stringify(queries, null, 2));

    // Specifically look for locks
    const locks = await prisma.$queryRaw`
      SELECT t.relname AS table_name, l.mode, l.granted, a.query, a.pid
      FROM pg_locks l
      JOIN pg_class t ON l.relation = t.oid
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE t.relname ILIKE '%Shop%' OR t.relname ILIKE '%Order%'
    `;
    
    console.log('\n--- LOCKS ON SHOP/ORDER ---');
    console.log(JSON.stringify(locks, null, 2));

    // Automatically terminate older hanging nodes if found
    for (const q of (queries || [])) {
      if (q.pid !== process.pid && q.query.includes('prisma') && q.state === 'active') {
        console.log(`\nKilling hanging backend PID: ${q.pid}`);
        await prisma.$executeRawUnsafe(`SELECT pg_terminate_backend(${q.pid})`);
      }
    }

  } catch (e) {
    console.error('Diagnostic failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
