require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const token = jwt.sign(
      { id: 'cmmsvsnt000008k4xtrnf81d1', shopId: 'cmmsvsnt100108k4xuw75nlgb', role: 'ADMIN' },
      process.env.JWT_SECRET || 'supersecret'
    );
    
    console.log('Fetching /api/orders/kitchen...');
    const { data } = await axios.get('http://localhost:4000/api/orders/kitchen', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('KITCHEN API RESPONSE:');
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('API ERROR:', err.response?.data || err.message);
  }
})();
