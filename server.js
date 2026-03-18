require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { seedDemoData } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({ origin: process.env.BASE_URL || 'http://localhost:3000', credentials: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'reviewcoin_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false // Set to true in production with HTTPS
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/api/admin', require('./routes/admin'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Seed demo data
if (process.env.DEMO_MODE === 'true') {
  seedDemoData();
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ReviewCoin Platform çalışıyor: http://localhost:${PORT}`);
  console.log(`📋 Demo Mode: ${process.env.DEMO_MODE === 'true' ? 'AÇIK' : 'KAPALI'}\n`);
});
