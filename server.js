// server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
app.use(express.json());

// === ToyyibPay Bill Creation ===
app.post('/api/toyyib/create-bill', async (req, res) => {
  try {
    const order = req.body;
    console.log('Creating ToyyibPay bill for order:', order);

    const form = new FormData();
    form.append('userSecretKey', process.env.TOYYIBPAY_SECRET_KEY);
    form.append('categoryCode', process.env.TOYYIBPAY_CATEGORY_CODE);
    form.append('billName', 'Proride Parts Order');
    form.append('billDescription', 'Order payment');
    form.append('billPriceSetting', 1);
    // ✅ ToyyibPay expects amount in sen
    form.append('billAmount', Math.round(order.total * 100));
    form.append('billReturnUrl', process.env.TOYYIBPAY_RETURN_URL);
    form.append('billCallbackUrl', process.env.TOYYIBPAY_CALLBACK_URL);
    form.append('billTo', order.customer.name);
    form.append('billEmail', order.customer.email);
    form.append('billPhone', order.customer.phone);

    const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    console.log('ToyyibPay response:', data);

    if (Array.isArray(data) && data[0] && data[0].BillCode) {
      return res.json({
        success: true,
        paymentUrl: `https://toyyibpay.com/${data[0].BillCode}`
      });
    } else {
      return res.json({ success: false, error: data });
    }
  } catch (err) {
    console.error('ToyyibPay error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === ToyyibPay Callback ===
app.post('/api/toyyib/callback', async (req, res) => {
  console.log('ToyyibPay callback received:', req.body);

  const { status, order_id } = req.body;

  if (status === '1') { // 1 = payment success
    // TODO: lookup order by order_id (from DB or memory)
    const order = req.body.order || {}; // placeholder

    // Trigger EasyParcel shipment creation
    try {
      const shipmentResp = await createEasyParcelShipment(order);
      console.log('EasyParcel shipment created:', shipmentResp);
    } catch (err) {
      console.error('EasyParcel shipment error:', err);
    }
  }

  res.json({ success: true });
});

// === EasyParcel Rate Checking ===
app.post('/api/easyparcel/check-rate', async (req, res) => {
  try {
    const { order } = req.body;

    const totalWeight = order.items.reduce((sum, it) => {
      if (it.position.includes('FRONT') || it.position.includes('REAR')) return sum + 5 * it.quantity;
      if (it.position.includes('1SET')) return sum + 10 * it.quantity;
      if (it.type.includes('Sport Spring')) return sum + 8 * it.quantity;
      return sum + 5 * it.quantity;
    }, 0);

    const payload = {
      api_key: process.env.EASYPARCEL_API_KEY,
      bulk: [{
        pick_code: "43000", // your pickup postcode
        send_code: order.customer.postcode,
        weight: totalWeight
      }]
    };

    const response = await fetch('https://apiv2.easyparcel.my/?ac=EPOrderPriceChecking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('EasyParcel rate response:', data);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('EasyParcel rate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === EasyParcel Shipment Creation Helper ===
async function createEasyParcelShipment(order) {
  const totalWeight = order.items.reduce((sum, it) => {
    if (it.position.includes('FRONT') || it.position.includes('REAR')) return sum + 5 * it.quantity;
    if (it.position.includes('1SET')) return sum + 10 * it.quantity;
    if (it.type.includes('Sport Spring')) return sum + 8 * it.quantity;
    return sum + 5 * it.quantity;
  }, 0);

  const payload = {
    api_key: process.env.EASYPARCEL_API_KEY,
    bulk: [{
      pick_name: process.env.SENDER_NAME,
      pick_contact: process.env.SENDER_PHONE,
      pick_addr1: process.env.SENDER_ADDRESS,
      pick_postcode: "43000",
      send_name: order.customer.name,
      send_contact: order.customer.phone,
      send_addr1: order.customer.address,
      send_postcode: order.customer.postcode,
      weight: totalWeight,
      content: "Car parts",
      value: order.total
    }]
  };

  const response = await fetch('https://apiv2.easyparcel.my/?ac=EPSubmitOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}

// === Start server ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
