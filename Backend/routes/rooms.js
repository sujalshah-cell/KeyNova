const express = require('express');
const asyncH = require('../middleware/asyncHandler');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const { generateText } = require('../utils/texts');

const router = express.Router();

function makeRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function publicRoom(room, { includeText = true } = {}) {
  return {
    roomId: room.roomId,
    ownerUsername: room.ownerUsername,
    mode: room.mode,
    duration: room.duration,
    text: includeText ? room.text : undefined,
    maxPlayers: room.maxPlayers,
    status: room.status,
    participants: room.participants,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
    createdAt: room.createdAt
  };
}

// Same delivery mechanism used in sockets/index.js: push to every current
// participant's personal channel, which they join the instant their socket
// connects — this reaches them even if they haven't opened the room page.
function notifyParticipants(io, room, event, payload) {
  room.participants.forEach((p) => {
    io.to(`user:${p.userId}`).emit(event, payload);
  });
}

// POST /api/rooms  -- create a room
router.post('/', requireAuth, async (req, res) => {
  try {
    const { mode = 'time', duration = 60, wordCount = 100, customText = '', maxPlayers = 10, password } = req.body;
    if (typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Room password must be at least 4 characters' });
    }
    const cappedMax = Math.min(Math.max(Number(maxPlayers) || 10, 2), 10);
    const text = generateText({ mode, duration, wordCount, customText });

    let roomId;
    for (let i = 0; i < 5; i++) {
      const candidate = makeRoomId();
      const exists = await Room.findOne({ roomId: candidate });
      if (!exists) { roomId = candidate; break; }
    }
    if (!roomId) return res.status(500).json({ error: 'Could not allocate room id, try again' });

    const passwordHash = await bcrypt.hash(password, 10);

    const room = await Room.create({
      roomId,
      passwordHash,
      ownerId: req.user._id,
      ownerUsername: req.user.username,
      mode,
      duration,
      wordCount: Number(wordCount) || 100,
      text,
      maxPlayers: cappedMax,
      participants: [{
        userId: req.user._id, username: req.user.username, isOwner: true
      }]
    });

    res.status(201).json({ room: publicRoom(room), password }); // echo password once so owner can share it
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/rooms/join
router.post('/join', requireAuth, async (req, res) => {
  try {
    const roomId = String(req.body.roomId || '');
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!roomId || !password) return res.status(400).json({ error: 'Room ID and password are required' });

    const room = await Room.findOne({ roomId: roomId.toUpperCase().trim() });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'racing' || room.status === 'finished') {
      return res.status(409).json({ error: 'This race has already started or finished' });
    }

    const ok = await bcrypt.compare(password, room.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Incorrect room password' });

    const already = room.participants.find(p => String(p.userId) === String(req.user._id));
    if (!already) {
      if (room.participants.length >= room.maxPlayers) {
        return res.status(409).json({ error: 'Room is full (max ' + room.maxPlayers + ' players)' });
      }
      room.participants.push({ userId: req.user._id, username: req.user.username });
      await room.save();

      // notify the room owner
      const note = await Notification.create({
        userId: room.ownerId,
        type: 'room_join',
        message: `${req.user.username} joined your room ${room.roomId}`,
        data: { roomId: room.roomId, username: req.user.username }
      });

      const io = req.app.get('io');
      io.to(`user:${room.ownerId}`).emit('notification:new', note);
      // Broadcast to every participant's personal channel — reaches the
      // owner (and anyone else already in the room) instantly, with no
      // dependency on whether their socket has "opened" this specific
      // room's page yet.
      notifyParticipants(io, room, 'room:update', publicRoom(room));
    }

    res.json({ room: publicRoom(room) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// GET /api/rooms/:roomId  -- must already be a participant
router.get('/:roomId', requireAuth, asyncH(async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId.toUpperCase() });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const isParticipant = room.participants.some(p => String(p.userId) === String(req.user._id));
  if (!isParticipant) return res.status(403).json({ error: 'You are not in this room' });
  res.json({ room: publicRoom(room) });
}));

module.exports = router;