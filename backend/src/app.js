const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/errorMiddleware');
const path = require('path');
const marketplaceRoutes = require('./modules/marketplace/marketplace.routes');

const app = express();

// Trust reverse proxy headers (e.g. Nginx X-Forwarded-Host)
app.set('trust proxy', true);

// Middlewares
const allowedOrigins = [
  'https://m1.workforce.themilabs.com',
  'https://tunepath.askeva.io',
  'http://m1.workforce.themilabs.com',
  'https://tunepath.askeva.io/',
  'http://localhost:5173',
  'http://localhost:5173/'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin public requests)
    // or allowed origins, or any origin for public website resolution APIs
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      // Allow custom connected domain requests to access public APIs
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware (required for OAuth state persistence)
app.use(session({
  secret: process.env.SESSION_SECRET || 'bcc_oauth_session_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update (seconds)
    ttl: 60 * 60, // 1 hour TTL for OAuth sessions
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1 hour
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// Local uploads folder removed, using Cloudinary instead

// Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorMiddleware);

module.exports = app;
