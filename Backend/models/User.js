const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },

  // Optional now: OAuth-only accounts (Google/GitHub) never receive a local
  // password. Local accounts still get this set at registration time.
  passwordHash: { type: String, default: null },

  avatar: { type: String, default: null },

  // ---- Account linking -------------------------------------------------
  // A single KeyNova user can have a local password AND/OR any number of
  // linked OAuth providers. Each provider id is unique+sparse so multiple
  // users can each have `google: null` without violating the unique index.
   // IMPORTANT: no `default: null` here. A field with no default stays
  // completely ABSENT on new documents unless explicitly set — which is
  // what the sparse unique index below actually requires to skip a
  // document. `default: null` was writing a literal null into every new
  // user, which the index does NOT treat as sparse, causing every second
  // signup to collide on a duplicate-key error.
  providers: {
    google: { type: String },
    github: { type: String }
  },

  stats: {
    testsCompleted: { type: Number, default: 0 },
    bestWpm: { type: Number, default: 0 },
    avgWpm: { type: Number, default: 0 },
    avgAccuracy: { type: Number, default: 0 },
    totalChars: { type: Number, default: 0 }
  },
  streak: {
    current: { type: Number, default: 0 },
    lastTestDate: { type: Date, default: null }
  },
  settings: {
    // --- existing fields (unchanged, preserved for existing users) ---
    theme: { type: String, default: 'light' },
    soundEnabled: { type: Boolean, default: true },
    keyboardSounds: { type: Boolean, default: false },

    // --- new: Appearance ---
    backgroundTheme: { type: String, default: 'clean-white' },
    font: { type: String, default: 'poppins' },
    fontSize: { type: Number, default: 23 },
    uiDensity: { type: String, default: 'comfortable' }, // 'comfortable' | 'compact'

    // --- new: Typing experience ---
    typingEffect: { type: String, default: 'none' },
    caretStyle: { type: String, default: 'line' }, // 'line' | 'block'
    errorEffect: { type: String, default: 'shake' },
    correctEffect: { type: String, default: 'none' },
    wordCompleteEffect: { type: String, default: 'none' }
  }
}, { timestamps: true });

// Sparse unique indexes: many users will have providers.google === null.
// `sparse: true` means the index ignores documents where the field is null,
// so it only enforces uniqueness among documents that actually have a value.
UserSchema.index({ 'providers.google': 1 }, { unique: true, sparse: true });
UserSchema.index({ 'providers.github': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', UserSchema);
