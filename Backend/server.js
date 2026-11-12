
require('dotenv').config();

console.log('>>> SERVER.JS LOADED - VERSION CHECK <<<');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const statsRoutes = require('./routes/stats');
const notificationRoutes = require('./routes/notifications');

const attachSockets = require('./sockets/index');

const app = express();

// Behind Render/Heroku/Nginx the real client IP is in X-Forwarded-For.
app.set('trust proxy', 1);

const server = http.createServer(app);

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header
    // (curl, Postman, server-to-server requests, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // If no CORS_ORIGIN is configured, allow the request.
    // This is useful during initial backend testing.
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,
};

// --------------------------------------------------
// Socket.IO
// --------------------------------------------------

const io = new Server(server, {
  cors: corsOptions,
});

app.set('io', io);

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

app.use(
  morgan(
    process.env.NODE_ENV === 'production'
      ? 'combined'
      : 'dev'
  )
);

// --------------------------------------------------
// Rate limiting
// --------------------------------------------------

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
});

// --------------------------------------------------
// API routes
// --------------------------------------------------

app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/rooms/join', joinLimiter);

app.use('/api/rooms', roomRoutes);

app.use('/api/stats', statsRoutes);

app.use('/api/notifications', notificationRoutes);

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
  });
});

// --------------------------------------------------
// Unknown API routes
// --------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not found',
  });
});

// --------------------------------------------------
// Backend root route
// --------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    name: 'KeyNova API',
    status: 'running',
    message: 'KeyNova backend is running successfully.',
  });
});

// --------------------------------------------------
// Final error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error(
    'Unhandled route error:',
    err && err.message ? err.message : err
  );

  if (res.headersSent) {
    return;
  }

  res.status(err.status || 500).json({
    error: 'Something went wrong on the server.',
  });
});

// --------------------------------------------------
// Process-level error handling
// --------------------------------------------------

process.on('unhandledRejection', (reason) => {
  console.error(
    'Unhandled promise rejection:',
    reason && reason.message
      ? reason.message
      : reason
  );
});

// --------------------------------------------------
// Socket.IO
// --------------------------------------------------

attachSockets(io);

// --------------------------------------------------
// Start server
// --------------------------------------------------

const PORT = https://keynova-9jv2.onrender.com;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(
      `KeyNova server listening on port ${PORT}`
    );
  });
});

