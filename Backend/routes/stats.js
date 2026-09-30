const express = require('express');
const asyncH = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const TypingResult = require('../models/TypingResult');
const User = require('../models/User');

const router = express.Router();

function isConsecutiveDay(prev, now) {
  if (!prev) return false;
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = new Date(now).setHours(0, 0, 0, 0) - new Date(prev).setHours(0, 0, 0, 0);
  return diff === oneDay;
}
function isSameDay(prev, now) {
  if (!prev) return false;
  return new Date(prev).toDateString() === new Date(now).toDateString();
}

// POST /api/stats/result  -- save a completed typing test
router.post('/result', requireAuth, async (req, res) => {
  try {
    const { mode, roomId } = req.body;
    const wpm = Number(req.body.wpm);
    const accuracy = Number(req.body.accuracy);
    const chars = Number(req.body.chars);
    const duration = Number(req.body.duration);
    const consistency = req.body.consistency == null ? 0 : Number(req.body.consistency);
    if ([wpm, accuracy, chars, duration, consistency].some((n) => !Number.isFinite(n))
        || req.body.wpm == null || req.body.accuracy == null || req.body.chars == null || req.body.duration == null) {
      return res.status(400).json({ error: 'Missing or invalid result fields' });
    }
    if (wpm < 0 || wpm > 500 || accuracy < 0 || accuracy > 100 || chars < 0 || duration <= 0) {
      return res.status(400).json({ error: 'Result values are out of range' });
    }

    const result = await TypingResult.create({
      userId: req.user._id, mode: String(mode || 'unknown').slice(0, 40),
      wpm, accuracy, chars, duration, consistency,
      roomId: typeof roomId === 'string' ? roomId : null
    });

    const user = req.user;
    const n = user.stats.testsCompleted;
    user.stats.avgWpm = Math.round(((user.stats.avgWpm * n) + wpm) / (n + 1));
    user.stats.avgAccuracy = Math.round((((user.stats.avgAccuracy * n) + accuracy) / (n + 1)) * 10) / 10;
    user.stats.testsCompleted = n + 1;
    user.stats.bestWpm = Math.max(user.stats.bestWpm, wpm);
    user.stats.totalChars += chars;

    const now = new Date();
    if (isSameDay(user.streak.lastTestDate, now)) {
      // same day, streak unchanged
    } else if (isConsecutiveDay(user.streak.lastTestDate, now)) {
      user.streak.current += 1;
      user.streak.lastTestDate = now;
    } else {
      user.streak.current = 1;
      user.streak.lastTestDate = now;
    }
    await user.save();

    res.status(201).json({ result, stats: user.stats, streak: user.streak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// GET /api/stats  -- overview + recent history for charts
router.get('/', requireAuth, asyncH(async (req, res) => {
  const recent = await TypingResult.find({ userId: req.user._id })
    .sort({ createdAt: -1 }).limit(30).lean();
  res.json({ stats: req.user.stats, streak: req.user.streak, recent: recent.reverse() });
}));

module.exports = router;
