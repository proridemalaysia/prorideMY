// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // make sure node-fetch is installed
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// === ToyyibPay: Create Bill ===
app.post('/api/toyyib/create-bill', async (req, res) => {
  try {
    const order = req.body;
    console.log('ToyyibPay create-bill called, order:', order);

    const form = new URLSearchParams();
    form.append('userSecretKey', process.env.TOYYIBPAY_SECRETKEY);
    form.append('categoryCode', process.env.TOYYIBPAY_CATEGORY);
    form.append('billName', 'Proride Order');
    form.append('billDescription', `Order total RM ${order.total}`);
    form.append('billPriceSetting', '1');
    form.append('billPayorInfo', '1');
    form.append('billAmount', order.total.toFixed(2));
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

    if (!data || !data[0] || !data[0].BillCode) {
      return res.status(500).json({ success: false, error: 'Failed to create bill', raw: data });
    }

    const billcode = data[0].BillCode;
    const paymentUrl = `https://toyyibpay.com/${billcode}`;
    return res.json({ success: true, billcode, paymentUrl });
  } catch (err) {
    console.error('ToyyibPay error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === ToyyibPay Callback ===
app.post('/api/toyyib/callback', (req, res) => {
  console.log('ToyyibPay callback received:', req.body);
  // TODO: verify authenticity and update order status in DB
  res.json({ success: true });
});

// === EasyParcel: Create Shipment (scaffold) ===
app.post('/api/easyparcel/create-shipment', async (req, res) => {
  try {
    const { order, payment } = req.body;
    console.log('EasyParcel create-shipment called:', order);

    const payload = {
      api_key: process.env.EASYPARCEL_API_KEY,
      pickup: {
        name: process.env.SENDER_NAME,
        phone: process.env.SENDER_PHONE,
        address: process.env.SENDER_ADDRESS
      },
      delivery: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address || 'Customer address placeholder'
      },
      parcels: order.items.map(it => ({
        description: `${it.model} ${it.type}`,
        quantity: it.quantity,
        weight: 1
      }))
    };

    // Example EasyParcel endpoint (replace with real one)
    const easyUrl = 'https://apiv2.easyparcel.my/v1/parcel/create';
    const response = await fetch(easyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('EasyParcel response:', data);

    return res.json({ success: true, data });
  } catch (err) {
    console.error('EasyParcel error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === EasyParcel Callback (optional) ===
app.post('/api/easyparcel/callback', (req, res) => {
  console.log('EasyParcel callback received:', req.body);
  // TODO: verify and update shipment status
  res.json({ success: true });
});

// === Fallback route: serve index.html for any other GET ===
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
