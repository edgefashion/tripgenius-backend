// ============================================
// TripGenius AI — Main Server (Final Version)
// ============================================

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS — fixes mongodb+srv lookup issues

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 10, skip: (req) => !req.path.includes('/ai') }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== DATABASE =====
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tripgenius')
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ===== ROUTE IMPORTS =====
const {
  bookingRouter,
  restaurantRouter,
  rideRouter,
  reviewRouter,
  groupRouter,
  destRouter,
  userRouter,
  adminRouter,
} = require('./routes/all-routes');

// ===== ROUTES =====
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/trips',        require('./routes/trips'));
app.use('/api/ai',           require('./routes/ai'));
app.use('/api/bookings',     bookingRouter);
app.use('/api/restaurants',  restaurantRouter);
app.use('/api/rides',        rideRouter);
app.use('/api/reviews',      reviewRouter);
app.use('/api/groups',       groupRouter);
app.use('/api/destinations', destRouter);
app.use('/api/users',        userRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/rooms',        require('./routes/rooms'));

// Health check
app.get('/api/health', (req, res) => res.json({
  success: true, message: 'TripGenius AI chal raha hai! 🚀',
  time: new Date().toISOString()
}));

// ===== API DOCS (simple) =====
app.get('/api', (req, res) => res.json({
  name: 'TripGenius AI API',
  version: '1.0.0',
  endpoints: {
    auth:         ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
    ai:           ['POST /api/ai/generate-trip', 'POST /api/ai/recommend-destinations', 'POST /api/ai/budget-optimize', 'POST /api/ai/crowd-predict'],
    trips:        ['GET /api/trips/my', 'POST /api/trips', 'GET /api/trips/:id', 'DELETE /api/trips/:id'],
    rooms:        ['GET /api/rooms', 'POST /api/rooms', 'GET /api/rooms/:id', 'PUT /api/rooms/:id', 'DELETE /api/rooms/:id'],
    bookings:     ['POST /api/bookings', 'GET /api/bookings/my', 'PATCH /api/bookings/:id/status'],
    restaurants:  ['GET /api/restaurants', 'POST /api/restaurants', 'GET /api/restaurants/:id'],
    rides:        ['GET /api/rides', 'POST /api/rides', 'PATCH /api/rides/:id/availability'],
    reviews:      ['POST /api/reviews', 'GET /api/reviews/:type/:targetId'],
    groups:       ['POST /api/groups', 'GET /api/groups/my', 'GET /api/groups/:id', 'POST /api/groups/:id/expense'],
    destinations: ['GET /api/destinations', 'GET /api/destinations/:id'],
    users:        ['GET /api/users/profile', 'POST /api/users/wishlist/:destId'],
    admin:        ['GET /api/admin/stats', 'GET /api/admin/users', 'GET /api/admin/rooms/pending'],
  }
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 TripGenius server: http://localhost:${PORT}`);
  console.log(`📖 API docs: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
