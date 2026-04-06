const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE = 'http://localhost:4000'; // Change to production URL if testing live
const TOKEN = 'YOUR_JWT_HERE'; // Requires a valid token to bypass auth

async function testPerformance(endpoint) {
    console.log(`\nTesting ${endpoint}...`);
    for (let i = 1; i <= 3; i++) {
        const start = performance.now();
        try {
            const res = await axios.get(`${API_BASE}${endpoint}`, {
                headers: { Authorization: `Bearer ${TOKEN}` }
            });
            const end = performance.now();
            console.log(`  Hit ${i}: ${(end - start).toFixed(2)}ms (Cache: ${res.data.isCached ? 'YES' : 'NO'})`);
        } catch (e) {
            console.error(`  Hit ${i} Failed: ${e.message}`);
        }
    }
}

// In a real scenario, we'd provide the user with a command to run this 
// since I don't have their JWT. 
// Instead, I'll use the browser tool to verify visually.
