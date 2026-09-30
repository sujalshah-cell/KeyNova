const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

// ---------------------------------------------------------------------------
// CSRF-safe "state" param, without needing express-session / a session store.
// We sign a short-lived JWT and hand it to the provider as `state`; the
// callback verifies it came from us and hasn't expired (5 minutes).
// ---------------------------------------------------------------------------
function createState(extra = {}) {
  return jwt.sign({ ...extra, typ: 'oauth_state' }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function verifyState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.typ !== 'oauth_state') throw new Error('Invalid state token');
  return payload;
}

// ---------------------------------------------------------------------------
// Google — Authorization Code flow. We exchange the code server-side (the
// client secret never touches the browser) and verify the returned ID token's
// signature via Google's published JWKS using google-auth-library, so we
// never trust an unverified token.
// ---------------------------------------------------------------------------
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

async function exchangeGoogleCode(code) {
  const { tokens } = await googleClient.getToken(code);
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload(); // { sub, email, email_verified, name, picture, ... }
  return {
    providerId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
    avatar: payload.picture || null
  };
}

// ---------------------------------------------------------------------------
// GitHub — plain fetch, no extra dependency needed (Node 18+ has global fetch).
// ---------------------------------------------------------------------------
async function exchangeGithubCode(code) {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.error_description || 'GitHub token exchange failed');

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'KeyNova' }
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'KeyNova' }
    })
  ]);
  const profile = await userRes.json();
  const emails = await emailsRes.json().catch(() => []);
  const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) || emails[0] : null;

  return {
    providerId: String(profile.id),
    email: (primary?.email || profile.email || '').toLowerCase(),
    emailVerified: !!primary?.verified,
    name: profile.name || profile.login,
    avatar: profile.avatar_url || null
  };
}

// ---------------------------------------------------------------------------
// Find-or-create + account linking. Never creates a duplicate account for an
// email that already exists — it links the new provider onto it instead.
// ---------------------------------------------------------------------------
async function generateUniqueUsername(base) {
  const cleaned = (base || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user';
  let candidate = cleaned;
  for (let i = 0; i < 6; i++) {
    const exists = await User.findOne({ username: candidate });
    if (!exists) return candidate;
    candidate = `${cleaned}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${cleaned}${Date.now().toString().slice(-6)}`;
}

// Errors carrying a message that is safe to show to end users.
class AuthFlowError extends Error {
  constructor(message) { super(message); this.userMessage = message; }
}

async function findOrCreateOAuthUser(provider, profile) {
  // 1) Already linked to this exact provider account?
  const existingByProvider = await User.findOne({ [`providers.${provider}`]: profile.providerId });
  if (existingByProvider) return existingByProvider;

  // Security: only trust an email the provider itself says is verified.
  // Linking (or creating) by an unverified email would let anyone claim
  // somebody else's KeyNova account by signing up at a provider with it.
  if (!profile.email || profile.emailVerified !== true) {
    throw new AuthFlowError(
      'Your email address is not verified with this provider, so we cannot sign you in. Verify it there and try again.'
    );
  }
  const email = profile.email.toLowerCase();

  // 2) An account with this (verified) email already exists — link the
  //    provider onto it instead of creating a duplicate user.
  const existingByEmail = await User.findOne({ email });
  if (existingByEmail) {
    const already = existingByEmail.providers?.[provider];
    if (already && already !== profile.providerId) {
      throw new AuthFlowError('This account is already connected to another login method.');
    }
    existingByEmail.providers[provider] = profile.providerId;
    if (!existingByEmail.avatar && profile.avatar) existingByEmail.avatar = profile.avatar;
    await existingByEmail.save();
    return existingByEmail;
  }

  // 3) Brand new user, OAuth-only (no local password). Role/permissions are
  //    never derived from provider data.
  const username = await generateUniqueUsername(profile.name || email.split('@')[0]);
  return User.create({
    username,
    email,
    passwordHash: null,
    avatar: profile.avatar || null,
    providers: { [provider]: profile.providerId }
  });
}

// Attach a provider identity to an ALREADY signed-in user (Settings > Login methods).
async function linkProviderToUser(userId, provider, profile) {
  const owner = await User.findOne({ [`providers.${provider}`]: profile.providerId });
  if (owner && String(owner._id) !== String(userId)) {
    throw new AuthFlowError('That account is already connected to a different KeyNova user.');
  }
  const user = await User.findById(userId);
  if (!user) throw new AuthFlowError('Your session has expired. Please sign in again.');
  user.providers[provider] = profile.providerId;
  if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
  await user.save();
  return user;
}

module.exports = {
  AuthFlowError,
  linkProviderToUser,
  createState,
  verifyState,
  exchangeGoogleCode,
  exchangeGithubCode,
  findOrCreateOAuthUser
};
