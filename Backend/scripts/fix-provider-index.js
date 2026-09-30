// One-time fix for the providers.google / providers.github sparse-index bug.
// Run once with: node scripts/fix-provider-index.js
// Safe to run multiple times.
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Cleaning up...');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  // Remove the literal `null` so the field goes back to being ABSENT,
  // which is what a sparse index actually needs to skip a document.
  const r1 = await users.updateMany(
    { 'providers.google': null },
    { $unset: { 'providers.google': '' } }
  );
  const r2 = await users.updateMany(
    { 'providers.github': null },
    { $unset: { 'providers.github': '' } }
  );
  console.log(`Unset providers.google on ${r1.modifiedCount} users`);
  console.log(`Unset providers.github on ${r2.modifiedCount} users`);

  // Drop the old indexes (built while the schema still had default:null)
  // so Mongoose recreates fresh, correctly-sparse ones on next startup.
  const existing = await users.indexes();
  for (const idx of existing) {
    if (idx.name === 'providers.google_1' || idx.name === 'providers.github_1') {
      console.log('Dropping old index:', idx.name);
      await users.dropIndex(idx.name);
    }
  }

  console.log('Done. Restart the backend now — Mongoose will recreate the indexes correctly.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});