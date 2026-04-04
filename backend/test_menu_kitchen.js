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

    console.log('1. Fetching Menu...');
    const menuRes = await axios.get('http://127.0.0.1:4000/api/menu?shopId=cmmsvsnt100108k4xuw75nlgb');
    const firstProduct = menuRes.data.products[0];
    if (!firstProduct) throw new Error('No products in menu');

    console.log('2. Emulating Scanner "POST /api/menu/order"...');
    const orderRes = await axios.post('http://127.0.0.1:4000/api/menu/order', {
      shopId: 'cmmsvsnt100108k4xuw75nlgb',
      customerName: 'IPv4 Test',
      paymentMethod: 'CASH',
      items: [{ productId: firstProduct.id, quantity: 1 }],
      notes: 'Direct API Test'
    });
    console.log('Menu Order Created:', orderRes.data.invoiceNumber);

    console.log('3. Checking Kitchen Display API...');
    const kitRes = await axios.get('http://127.0.0.1:4000/api/orders/kitchen', { headers });
    const kitchenOrders = kitRes.data.orders;
    console.log(`Kitchen length: ${kitchenOrders.length}`);
    
    const found = kitchenOrders.find(o => o.id === orderRes.data.order.id);
    if (found) {
      console.log('SUCCESS! Scanner order found in Kitchen:', found.status);
    } else {
      console.log('FAILED! Scanner order NOT in kitchen.');
      console.log('All Kitchen Data:');
      console.dir(kitchenOrders, { depth: null });
      console.log('Original Order Creation Data:');
      console.dir(orderRes.data.order, { depth: null });
    }
  } catch (err) {
    console.error('API ERROR:', err.response?.data || err.message);
  }
})();
