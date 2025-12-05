// server.js
// Minimal Express server demonstrating ToyyibPay and EasyParcel server endpoints.
// Install dependencies: express, node-fetch, dotenv, body-parser
// Run: node server.js after setting environment variables

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm install node-fetch@2
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // serve index.html if placed in public/

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true }));

/*
  ToyyibPay create bill endpoint
  - Expects order payload from client
  - Calls ToyyibPay createBill API server-side using TOYYIBPAY_SECRETKEY and returns paymentUrl or billcode
  - Replace endpoint URL and parameters according to ToyyibPay docs
*/
app.post('/api/toyyib/create-bill', async (req, res) => {
  try {
    const order = req.body;
    // Build form data required by ToyyibPay
    const form = new URLSearchParams();
    form.append('userSecretKey', process.env.TOYYIBPAY_SECRETKEY || '');
    form.append('categoryCode', process.env.TOYYIBPAY_CATEGORY || '');
    form.append('billName', `Order ${Date.now()}`);
    form.append('billDescription', `Order total RM ${order.total}`);
    form.append('billPriceSetting', '1'); // 1 = fixed price
    form.append('billPayorInfo', '1'); // collect payor info
    form.append('billAmount', Math.round(order.total * 100) / 100); // price
    // optional: add custom fields
    form.append('billReturnUrl', process.env.TOYYIBPAY_RETURN_URL || '');
    form.append('billCallbackUrl', process.env.TOYYIBPAY_CALLBACK_URL || '');

    // ToyyibPay create bill endpoint (example)
    const toyUrl = 'https://toyyibpay.com/index.php/api/createBill';
    const resp = await fetch(toyUrl, { method: 'POST', body: form });
    const data = await resp.json();

    // data is expected to contain billcode or similar
    if (!data || !data[0] || !data[0].BillCode) {
      return res.json({ success: false, error: 'Invalid response from ToyyibPay', raw: data });
    }

    const billcode = data[0].BillCode;
    const paymentUrl = `https://toyyibpay.com/${billcode}`;

    return res.json({ success: true, billcode, paymentUrl });
  } catch (err) {
    console.error('ToyyibPay create-bill error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/*
  ToyyibPay callback webhook
  - ToyyibPay will POST payment result to your callback URL
  - Validate payload and update order status in your DB
  - For demo, we just log and return 200
*/
app.post('/api/toyyib/callback', (req, res) => {
  console.log('ToyyibPay callback received', req.body);
  // TODO: verify authenticity if ToyyibPay provides signature or secret
  // TODO: update order status in DB
  res.json({ success: true });
});

/*
  EasyParcel create shipment endpoint
  - Expects order and payment confirmation
  - Calls EasyParcel API server-side using EASYPARCEL_API_KEY
  - Replace endpoint and payload according to EasyParcel docs
*/
app.post('/api/easyparcel/create-shipment', async (req, res) => {
  try {
    const { order, payment } = req.body;
    // Build payload according to EasyParcel API
    const payload = {
      // Example fields; replace with actual required fields
      api_key: process.env.EASYPARCEL_API_KEY || '',
      pickup: {
        name: process.env.SENDER_NAME || 'Sender',
        phone: process.env.SENDER_PHONE || '60123456789',
        address: process.env.SENDER_ADDRESS || 'Sender address'
      },
      delivery: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address || 'Customer address placeholder'
      },
      parcels: order.items.map(it => ({ description: `${it.model} ${it.type}`, quantity: it.quantity, weight: 1 }))
    };

    // Example EasyParcel endpoint (replace with real)
    const easyUrl = 'https://apiv2.easyparcel.my/v1/parcel/create'; // placeholder
    const resp = await fetch(easyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY || ''}` },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    // Return whatever EasyParcel returns
    return res.json({ success: true, data });
  } catch (err) {
    console.error('EasyParcel create-shipment error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/*
  EasyParcel webhook or status update endpoint
  - Implement if EasyParcel supports callbacks
*/
app.post('/api/easyparcel/callback', (req, res) => {
  console.log('EasyParcel callback', req.body);
  // TODO: verify and update shipment status
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
