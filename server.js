const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Example API route (ToyyibPay demo)
app.post('/api/toyyib/create-bill', async (req, res) => {
  // For now just return a mock response
  res.json({ success: true, billcode: 'MOCK', paymentUrl: 'https://toyyibpay.com/MOCK' });
});

// Fallback route: send index.html for any other GET request
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
