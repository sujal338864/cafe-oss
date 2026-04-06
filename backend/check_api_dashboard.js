const axios = require('axios');

async function checkDashboard() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:4001/api/auth/login', {
      email: 'admin@cafeosz.com',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token acquired.');

    // 2. Fetch Dashboard Stats
    const statsRes = await axios.get('http://localhost:4001/api/analytics/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('--- DASHBOARD STATS ---');
    console.log(JSON.stringify(statsRes.data, null, 2));

  } catch (error) {
    console.error('Error checking dashboard:', error.response ? error.response.data : error.message);
  }
}

checkDashboard();
