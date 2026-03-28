require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const token = jwt.sign(
      { id: 'cmmsvsnt000008k4xtrnf81d1', shopId: 'cmmsvsnt100108k4xuw75nlgb', role: 'ADMIN' },
      process.env.JWT_SECRET || 'supersecret'
    );
    const headers = { Authorization: `Bearer ${token}` };

    console.log('1. Creating POS Order...');
    const orderRes = await axios.post('http://localhost:4000/api/orders', {
      items: [{ productId: 'test_id', name: 'Test Pizza', quantity: 1, costPrice: 100, unitPrice: 150 }],
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      notes: 'Test Order'
    }, { headers });
    console.log('Order created:', orderRes.data.invoiceNumber);

    console.log('2. Fetching Kitchen...');
    const kitRes = await axios.get('http://localhost:4000/api/orders/kitchen', { headers });
    const kitchenOrders = kitRes.data.orders;
    console.log(`Kitchen length: ${kitchenOrders.length}`);
    const found = kitchenOrders.find(o => o.id === orderRes.data.id);
    if (found) {
      console.log('SUCCESS! Order found in Kitchen with status:', found.status);
    } else {
      console.log('FAILED! Order NOT in kitchen.');
      console.log('Kitchen data:', kitchenOrders);
    }
  } catch (err) {
    console.error('API ERROR:', err.response?.data || err.message);
  }
})();
