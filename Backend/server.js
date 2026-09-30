require('dotenv').config();
console.log('>>> SERVER.JS LOADED - VERSION CHECK <<<');
const express = require('express');
const http = require('http');
const path = require('path');
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
// Behind Render/Heroku/Nginx the real client IP is in X-Forwarded-For. Without
// this every visitor shares the proxy's IP and therefore ONE rate-limit bucket.
app.set('trust proxy', 1);
const server = http.createServer(app);

// ---- CORS: driven entirely by env var, no hardcoded localhost in production ----
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // same-origin requests (no Origin header) and curl/mobile apps are allowed
    if (!origin) return callback(null, true);
    // if no CORS_ORIGIN is configured, we assume single-origin deployment (frontend served by this server)
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

const io = new Server(server, { cors: corsOptions });
app.set('io', io);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// basic protection against brute-force on auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
// Room passwords are short, so throttle guessing separately.
const joinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms/join', joinLimiter);
app.use('/api/rooms', roomRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---- Serve the frontend (single-origin deployment: no CORS issues, no localhost URLs baked in) ----
const clientDir = path.join(__dirname, 'public');
app.use(express.static(clientDir));

// SPA fallback: any non-API route returns index.html so client-side routing
// survives a hard refresh or a direct link (e.g. /tournaments).
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Unknown /api routes -> JSON 404 (instead of the SPA HTML page)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Final error handler: never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: 'Something went wrong on the server.' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason && reason.message ? reason.message : reason);
});

attachSockets(io);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`KeyNova server listening on port ${PORT}`));
});
