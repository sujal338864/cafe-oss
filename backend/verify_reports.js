const axios = require('axios');

async function checkReports() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:4001/api/auth/login', {
      email: 'admin@cafeosz.com',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token acquired.');

    // 2. Fetch Daily Report
    const today = new Date().toISOString().split('T')[0];
    const dailyRes = await axios.get(`http://localhost:4001/api/analytics/reports/daily?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('--- DAILY REPORT API ---');
    console.log(JSON.stringify(dailyRes.data, null, 2));

    // 3. Fetch Monthly Report
    const mRes = await axios.get(`http://localhost:4001/api/analytics/reports/monthly?year=2026&month=3`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('--- MONTHLY REPORT API ---');
    console.log(JSON.stringify(mRes.data, null, 2));

  } catch (error) {
    console.error('Error checking reports:', error.response ? error.response.data : error.message);
  }
}

checkReports();
