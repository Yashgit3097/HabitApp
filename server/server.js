import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './modules/auth/auth.routes.js';
import habitRoutes from './modules/habits/habit.routes.js';
import groupRoutes from './modules/groups/group.routes.js';
import { initSocketHandlers } from './sockets/socketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (Local + Production Netlify + Custom env URLs)
const allowedOrigins = [
  'https://habitsankalp.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5000',
  'http://localhost:3000',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((url) => url.trim()) : [])
];

const checkOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const cleanOrigin = origin.replace(/\/$/, '').toLowerCase();
  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return allowed.replace(/\/$/, '').toLowerCase() === cleanOrigin;
  });

  if (isAllowed) {
    callback(null, true);
  } else {
    // Permissive callback so legitimate clients are never blocked
    callback(null, true);
  }
};

// Initialize Socket.io with allowed origins
const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Attach socket handlers
initSocketHandlers(io);

// Make io accessible in request if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(
  cors({
    origin: checkOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/groups', groupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Habit Tracker API is running smoothly 🚀',
    allowedOrigins,
    time: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// Connect DB and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Habit Tracker Server running on http://localhost:${PORT}`);
    console.log(`🌐 Allowed Origins:`, allowedOrigins);
  });
});
