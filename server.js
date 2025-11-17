// server.js - Node.js Proxy Server for Pincode API
// Run: node server.js
// Install dependencies: npm init -y && npm install express cors node-fetch@2

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXLyrSRGTG6evmY32bPyUvjgVAEsMaGRc_mENsqYisLO6Cj6oCG0XveSY6jqDLNpst/exec';

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies

// Proxy endpoint for pincodes
app.post('/pincodes', async (req, res) => {
  const { store } = req.body;
  if (!store) {
    return res.status(400).json({ error: 'Store name is required' });
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ store }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch pincodes' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});