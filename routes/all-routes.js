const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { Booking, Room, Ride, Restaurant, Review, GroupTrip, Destination, User, Trip, Wishlist } = require('../models');

// BOOKINGS
const bookingRouter = express.Router();
bookingRouter.post('/', protect, async (req, res) => {
  try {
    const { type, roomId, rideId, checkIn, checkOut, guests, notes } = req.body;
    let totalAmount = 0, commissionPct = 10;
    if (type === 'room' && roomId) {
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ success: false, message: 'Room nahi mila.' });
      const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
      totalAmount = room.pricePerNight * nights;
      commissionPct = room.commissionPct || 10;
    }
    if (type === 'ride' && rideId) {
      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride nahi mili.' });
      totalAmount = ride.pricePerDay || ride.priceFlat || 0;
      commissionPct = ride.commissionPct || 15;
    }
    const commissionAmt = Math.round(totalAmount * commissionPct / 100);
    const booking = await Booking.create({ user: req.user.id, type, room: roomId, ride: rideId, checkIn, checkOut, guests, notes, totalAmount, commissionAmt, ownerAmount: totalAmount - commissionAmt });
    res.status(201).json({ success: true, message: 'Booking bhej di!', booking });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
bookingRouter.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate('room', 'title location pricePerNight').populate('ride', 'name pricePerDay').sort('-createdAt');
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
bookingRouter.patch('/:id/status', protect, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (req.body.status === 'completed' && booking.room) await Room.findByIdAndUpdate(booking.room, { $inc: { totalBookings: 1, totalEarnings: booking.ownerAmount } });
    res.json({ success: true, message: 'Status update ho gaya!', booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
bookingRouter.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { status: 'cancelled', cancelReason: req.body.reason || '' }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking nahi mili.' });
    res.json({ success: true, message: 'Cancel ho gaya!', booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// RESTAURANTS
const restaurantRouter = express.Router();
restaurantRouter.get('/', async (req, res) => {
  try {
    const { city, type, page = 1, limit = 10 } = req.query;
    const filter = { status: 'active' };
    if (city) filter.city = new RegExp(city, 'i');
    if (type) filter.type = type;
    const restaurants = await Restaurant.find(filter).sort('-avgRating').skip((page-1)*limit).limit(+limit);
    res.json({ success: true, restaurants });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
restaurantRouter.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Nahi mila.' });
    res.json({ success: true, restaurant });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
restaurantRouter.post('/', protect, authorize('owner','admin'), async (req, res) => {
  try {
    const restaurant = await Restaurant.create({ ...req.body, owner: req.user.id });
    res.status(201).json({ success: true, restaurant });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// RIDES
const rideRouter = express.Router();
rideRouter.get('/', async (req, res) => {
  try {
    const { city, type, page = 1, limit = 10 } = req.query;
    const filter = { status: 'active', isAvailable: true };
    if (city) filter.city = new RegExp(city, 'i');
    if (type) filter.type = type;
    const rides = await Ride.find(filter).populate('provider','name phone').sort('-avgRating').skip((page-1)*limit).limit(+limit);
    res.json({ success: true, rides });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
rideRouter.post('/', protect, authorize('provider','owner','admin'), async (req, res) => {
  try {
    const ride = await Ride.create({ ...req.body, provider: req.user.id });
    res.status(201).json({ success: true, ride });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
rideRouter.patch('/:id/availability', protect, async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(req.params.id, { isAvailable: req.body.isAvailable }, { new: true });
    res.json({ success: true, ride });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// REVIEWS
const reviewRouter = express.Router();
reviewRouter.post('/', protect, async (req, res) => {
  try {
    const { type, targetId, rating, comment } = req.body;
    const existing = await Review.findOne({ user: req.user.id, type, targetId });
    if (existing) return res.status(400).json({ success: false, message: 'Pehle se review diya hai.' });
    const review = await Review.create({ user: req.user.id, type, targetId, rating, comment });
    const all = await Review.find({ type, targetId });
    const avg = (all.reduce((s,r) => s+r.rating, 0) / all.length).toFixed(1);
    if (type === 'room') await Room.findByIdAndUpdate(targetId, { avgRating: avg, totalReviews: all.length });
    if (type === 'restaurant') await Restaurant.findByIdAndUpdate(targetId, { avgRating: avg, totalReviews: all.length });
    await review.populate('user','name avatar');
    res.status(201).json({ success: true, review });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
reviewRouter.get('/:type/:targetId', async (req, res) => {
  try {
    const reviews = await Review.find({ type: req.params.type, targetId: req.params.targetId }).populate('user','name avatar').sort('-createdAt').limit(20);
    res.json({ success: true, reviews });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GROUPS
const groupRouter = express.Router();
groupRouter.post('/', protect, async (req, res) => {
  try {
    const group = await GroupTrip.create({ ...req.body, creator: req.user.id, members: [{ user: req.user.id, name: req.user.name, joinedAt: new Date() }] });
    res.status(201).json({ success: true, group });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
groupRouter.get('/my', protect, async (req, res) => {
  try {
    const groups = await GroupTrip.find({ 'members.user': req.user.id }).sort('-createdAt');
    res.json({ success: true, groups });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
groupRouter.get('/:id', protect, async (req, res) => {
  try {
    const group = await GroupTrip.findById(req.params.id).populate('members.user','name avatar');
    if (!group) return res.status(404).json({ success: false, message: 'Group nahi mila.' });
    res.json({ success: true, group });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
groupRouter.post('/:id/expense', protect, async (req, res) => {
  try {
    const group = await GroupTrip.findById(req.params.id);
    group.expenses.push({ ...req.body, paidBy: req.user.id, paidByName: req.user.name });
    await group.save();
    res.json({ success: true, group });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
groupRouter.post('/:id/note', protect, async (req, res) => {
  try {
    const group = await GroupTrip.findById(req.params.id);
    group.notes.push({ text: req.body.text, createdBy: req.user.name });
    await group.save();
    res.json({ success: true, group });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
groupRouter.post('/:id/join', protect, async (req, res) => {
  try {
    const group = await GroupTrip.findById(req.params.id);
    if (group.members.some(m => m.user?.toString() === req.user.id)) return res.status(400).json({ success: false, message: 'Already member ho.' });
    group.members.push({ user: req.user.id, name: req.user.name, joinedAt: new Date() });
    await group.save();
    res.json({ success: true, group });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// DESTINATIONS
const destRouter = express.Router();
destRouter.get('/', async (req, res) => {
  try {
    const { type, crowdLevel } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (crowdLevel) filter.crowdLevel = crowdLevel;
    const destinations = await Destination.find(filter).sort('-avgRating');
    res.json({ success: true, destinations });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
destRouter.get('/:id', async (req, res) => {
  try {
    const dest = await Destination.findById(req.params.id);
    if (!dest) return res.status(404).json({ success: false, message: 'Nahi mila.' });
    res.json({ success: true, destination: dest });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
destRouter.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const dest = await Destination.create(req.body);
    res.status(201).json({ success: true, destination: dest });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// USERS
const userRouter = express.Router();
userRouter.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const totalTrips = await Trip.countDocuments({ user: req.user.id });
    res.json({ success: true, user, totalTrips });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
userRouter.post('/wishlist/:destId', protect, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id }) || await Wishlist.create({ user: req.user.id, destinations: [] });
    const idx = wishlist.destinations.indexOf(req.params.destId);
    if (idx > -1) { wishlist.destinations.splice(idx, 1); } else { wishlist.destinations.push(req.params.destId); }
    await wishlist.save();
    res.json({ success: true, wishlist });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ADMIN
const adminRouter = express.Router();
adminRouter.use(protect, authorize('admin'));
adminRouter.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalRooms, totalBookings, totalRestaurants, totalRides] = await Promise.all([User.countDocuments(), Room.countDocuments(), Booking.countDocuments(), Restaurant.countDocuments(), Ride.countDocuments()]);
    const rev = await Booking.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$commissionAmt' } } }]);
    res.json({ success: true, stats: { totalUsers, totalRooms, totalBookings, totalRestaurants, totalRides, revenue: rev[0]?.total || 0 } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.get('/users', async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = role ? { role } : {};
    const [users, total] = await Promise.all([User.find(filter).sort('-createdAt').skip((page-1)*limit).limit(+limit), User.countDocuments(filter)]);
    res.json({ success: true, total, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.patch('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.get('/rooms/pending', async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'pending' }).populate('owner','name email');
    res.json({ success: true, rooms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.patch('/rooms/:id/approve', async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    res.json({ success: true, room });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.patch('/rooms/:id/reject', async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
    res.json({ success: true, room });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
adminRouter.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('user','name email').populate('room','title').sort('-createdAt').limit(50);
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = { bookingRouter, restaurantRouter, rideRouter, reviewRouter, groupRouter, destRouter, userRouter, adminRouter };
