// routes/rooms.js — Room Listing APIs

const express = require('express');
const router = express.Router();
const { Room, Booking } = require('../models');
const { protect, authorize } = require('../middleware/auth');

// GET /api/rooms — Saare rooms search karo
router.get('/', async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, guests, page = 1, limit = 10 } = req.query;

    const filter = { status: 'active' };
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (type) filter.type = type;
    if (minPrice || maxPrice) {
      filter.pricePerNight = {};
      if (minPrice) filter.pricePerNight.$gte = parseInt(minPrice);
      if (maxPrice) filter.pricePerNight.$lte = parseInt(maxPrice);
    }
    if (guests) filter.maxGuests = { $gte: parseInt(guests) };

    const total = await Room.countDocuments(filter);
    const rooms = await Room.find(filter)
      .populate('owner', 'name phone avatar')
      .populate('destination', 'name state emoji')
      .sort('-avgRating -createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, total, page: parseInt(page), rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/my — Owner ki apni listings
router.get('/my', protect, authorize('owner', 'admin'), async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user.id }).sort('-createdAt');
    res.json({ success: true, count: rooms.length, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/:id — Single room detail
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'name phone avatar')
      .populate('destination', 'name state emoji crowdLevel');
    if (!room) return res.status(404).json({ success: false, message: 'Room nahi mila.' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms — Nayi listing banao (owner only)
router.post('/', protect, authorize('owner', 'admin'), async (req, res) => {
  try {
    const room = await Room.create({ ...req.body, owner: req.user.id });
    res.status(201).json({ success: true, message: 'Listing create ho gaya! Admin review karega.', room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/rooms/:id — Listing update karo
router.put('/:id', protect, authorize('owner', 'admin'), async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, owner: req.user.id });
    if (!room && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Room nahi mila ya permission nahi.' });
    }
    const updated = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, message: 'Room update ho gaya!', room: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/rooms/:id — Listing delete karo
router.delete('/:id', protect, authorize('owner', 'admin'), async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, owner: req.user.id });
    if (!room && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Permission nahi.' });
    }
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Listing delete ho gaya!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/:id/bookings — Room ke saare bookings dekho (owner)
router.get('/:id/bookings', protect, authorize('owner', 'admin'), async (req, res) => {
  try {
    const bookings = await Booking.find({ room: req.params.id, type: 'room' })
      .populate('user', 'name email phone')
      .sort('-createdAt');
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/owner/earnings — Earnings dashboard
router.get('/owner/earnings', protect, authorize('owner'), async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user.id }, 'title totalEarnings totalBookings avgRating');
    const totalEarnings = rooms.reduce((sum, r) => sum + (r.totalEarnings || 0), 0);
    const totalBookings = rooms.reduce((sum, r) => sum + (r.totalBookings || 0), 0);

    // Monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentBookings = await Booking.find({
      room: { $in: rooms.map(r => r._id) },
      status: 'completed',
      createdAt: { $gte: sixMonthsAgo }
    }).sort('createdAt');

    res.json({ success: true, totalEarnings, totalBookings, rooms, recentBookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
