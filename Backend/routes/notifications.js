const express = require('express');
const asyncH = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, asyncH(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
  res.json({ items, unreadCount });
}));

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, asyncH(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { $set: { read: true } });
  res.json({ ok: true });
}));

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, asyncH(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
}));

module.exports = router;
