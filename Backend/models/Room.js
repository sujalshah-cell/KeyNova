const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  progress: { type: Number, default: 0 },
  wpm: { type: Number, default: 0 },
  accuracy: { type: Number, default: 100 },
  finished: { type: Boolean, default: false },
  finishedAt: { type: Date, default: null },
  isOwner: { type: Boolean, default: false }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, uppercase: true, index: true },
  passwordHash: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerUsername: { type: String, required: true },
  // Extended to match every race-format option in the Tournaments create
  // form: Timed race, Fixed word count, Custom text, Random quote, Code
  // snippet. 'words' was missing, which is why selecting "Fixed word
  // count" crashed room creation with a Mongoose enum validation error.
  mode: { type: String, enum: ['time', 'words', 'custom', 'quote', 'code'], default: 'time' },
  duration: { type: Number, default: 60 },
  wordCount: { type: Number, default: 100 },
  text: { type: String, required: true },
  maxPlayers: { type: Number, default: 10, min: 2, max: 10 },
  status: { type: String, enum: ['waiting', 'countdown', 'racing', 'finished'], default: 'waiting' },
  participants: { type: [ParticipantSchema], default: [] },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);