import { CircuitBreaker } from './common/circuitBreaker';
import { redis } from './lib/redis';

const runTest = async () => {
  const breaker = new CircuitBreaker('chaos_test', 3, 10); // 3 failures, 10s cooldown

  // Reset previous states
  await redis.del('circuit:chaos_test:state');
  await redis.del('circuit:chaos_test:failures');

  console.log('--- 🛡️ Starting Chaos Test Simulation (Threshold: 3 Failures) ---');

  const failingFunction = async () => {
    throw new Error('Database connection lost!');
  };

  const fallbackFunction = async () => {
    return 'Fallback Triggered: Serving generic cached response safely.';
  };

  for (let i = 1; i <= 5; i++) {
    console.log(`\n[Request #${i}] Triggering upstream call...`);
    
    const result = await breaker.execute(failingFunction, fallbackFunction);
    const state = await redis.get('circuit:chaos_test:state');
    
    console.log(`[Response] -> ${result}`);
    console.log(`[Circuit State] -> ${state || 'CLOSED'}`);
  }

  console.log('\n--- 🛡️ Chaos Test Concluded ---');
  await redis.quit(); // Guarantee clean exit
  process.exit(0);
};

runTest();
