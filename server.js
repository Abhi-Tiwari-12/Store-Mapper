// server.js - Production-Ready Proxy for https://store-mapper-20.netlify.app

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwXLyrSRGTG6evmY32bPyUvjgVAEsMaGRc_mENsqYisLO6Cj6oCG0XveSY6jqDLNpst/exec';

// Allowed origins — ADD YOUR NETLIFY URL HERE
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://store-mapper-20.netlify.app',
  'https://store-mapper-20.netlify.app/pincode-finder', // works too, but parent domain is sufficient
  // Add your custom domain later if you have one
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-side, mobile, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Simple IP-based rate limiter (100 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || req.connection.remoteAddress;
  const now = Date.now();

  const userRequests = rateLimitMap.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < WINDOW_MS);

  if (recentRequests.length >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests, please slow down.' });
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  next();
};

// Main proxy endpoint
app.post('/pincodes', rateLimiter, async (req, res) => {
  let { store } = req.body;

  if (!store || typeof store !== 'string') {
    return res.status(400).json({ error: 'Valid "store" field is required' });
  }

  store = store.trim().toLowerCase();

  // Optional: restrict to known stores only (recommended)
  const validStores = ['all', 'amazon', 'flipkart', 'myntra', 'meesho', 'jiomart', 'bigbasket'];
  if (!validStores.includes(store)) {
    return res.status(400).json({ error: 'Unsupported store' });
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StoreMapper-Proxy/1.0 (+https://store-mapper-20.netlify.app)',
      },
      body: JSON.stringify({ store }),
      timeout: 12000, // 12 seconds
    });

    const text = await response.text(); // Read as text first to debug easily

    if (!response.ok) {
      console.error(`Upstream error ${response.status}: ${text}`);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON from Google Apps Script:', text);
      return res.status(502).json({ error: 'Invalid response from server' });
    }

    res.json(data);

  } catch (err) {
    console.error('Proxy fetch error:', err.message);

    if (err.name === 'FetchError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Request timeout – upstream server slow' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), origin: 'store-mapper-proxy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server LIVE on port ${PORT}`);
  console.log(`Ready for https://store-mapper-20.netlify.app`);
});