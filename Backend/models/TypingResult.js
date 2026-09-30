const mongoose = require('mongoose');

const TypingResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, required: true },
  wpm: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  chars: { type: Number, required: true },
  consistency: { type: Number, default: 0 },
  duration: { type: Number, required: true },
  roomId: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TypingResult', TypingResultSchema);
