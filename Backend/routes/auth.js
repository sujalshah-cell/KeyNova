const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const {
  createState, verifyState,
  exchangeGoogleCode, exchangeGithubCode,
  findOrCreateOAuthUser, linkProviderToUser
} = require('../utils/oauth');
const asyncH = require('../middleware/asyncHandler');

const router = express.Router();

// `remember` (login form checkbox): true -> JWT_EXPIRES_IN (default 7d),
// false -> a shorter 1 day session.
function signToken(user, remember = true) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: remember ? (process.env.JWT_EXPIRES_IN || '7d') : '1d'
  });
}

// Never leak passwordHash or raw provider ids — only booleans the UI needs
// (e.g. "show a password field" / "show a Google-linked badge").
function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || null,
    hasPassword: !!user.passwordHash,
    linkedProviders: {
      google: !!user.providers?.google,
      github: !!user.providers?.github
    },
    stats: user.stats,
    streak: user.streak,
    settings: user.settings
  };
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || '').replace(/\/$/, '') || '';
}

// GET /api/auth/providers — lets the frontend only render buttons for
// providers that are actually configured, instead of guessing.
router.get('/providers', (req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    sso: false // enterprise SSO architecture below is a stub — see /sso/init
  });
});

// ---------------------------------------------------------------------------
// Local email/password auth (unchanged behavior, existing users unaffected)
// ---------------------------------------------------------------------------

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    // Coerce to strings so objects like { "$ne": null } can never reach a query.
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const exists = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
    if (exists) {
      const field = exists.username === username ? 'username' : 'email';
      return res.status(409).json({
        error: field === 'username' ? 'This username is already taken.' : 'This email is already registered.'
      });
    }

    // Hashing happens ONCE, here, on the server. The frontend must send the
    // plain password entered by the user — never a pre-hashed value.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email: email.toLowerCase(), passwordHash });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
// Accepts either `identifier` (username or email) OR `email`, so existing
// API consumers keep working and the React frontend's { email, password }
// body (see PART 22 of the brief) now matches without a breaking change.
router.post('/login', async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const remember = req.body.remember !== false;
    if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
    });
    if (!user || !user.passwordHash) {
      // Same generic message whether the account doesn't exist or is
      // OAuth-only — don't leak which one to a potential attacker.
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    // Backend performs the comparison. The client sends the plain-text
    // password entered in the form; bcrypt.compare does the hashing here.
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

    const token = signToken(user, remember);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PUT /api/auth/settings — extended with the new appearance/typing fields,
// all existing fields (theme, soundEnabled, keyboardSounds) still supported.
router.put('/settings', requireAuth, asyncH(async (req, res) => {
  const allowed = [
    'theme', 'soundEnabled', 'keyboardSounds',
    'backgroundTheme', 'font', 'fontSize', 'uiDensity',
    'typingEffect', 'caretStyle', 'errorEffect', 'correctEffect', 'wordCompleteEffect'
  ];
  const booleans = ['soundEnabled', 'keyboardSounds'];
  const user = req.user;
  for (const key of allowed) {
    const value = req.body[key];
    if (value === undefined) continue;
    if (booleans.includes(key)) {
      if (typeof value !== 'boolean') return res.status(400).json({ error: `${key} must be true or false` });
    } else if (key === 'fontSize') {
      if (!Number.isFinite(Number(value)) || Number(value) < 10 || Number(value) > 60) {
        return res.status(400).json({ error: 'fontSize must be a number between 10 and 60' });
      }
    } else if (typeof value !== 'string' || value.length > 40) {
      return res.status(400).json({ error: `${key} is invalid` });
    }
    user.settings[key] = key === 'fontSize' ? Number(value) : value;
  }
  await user.save();
  res.json({ user: publicUser(user) });
}));

// ---------------------------------------------------------------------------
// Google / GitHub OAuth (Authorization Code flow)
//   Browser -> GET /api/auth/<provider> -> provider consent screen -> provider
//   redirects to GET /api/auth/<provider>/callback?code=...&state=... -> we
//   exchange the code server-side, verify the identity, find-or-create the
//   KeyNova user, sign a KeyNova JWT, and redirect back to the frontend.
//   The token travels in the URL *fragment* (#token=...) so it is never sent
//   to any server or written to access logs. Provider passwords never touch
//   KeyNova at any point.
// ---------------------------------------------------------------------------
const PROVIDERS = {
  google: {
    label: 'Google',
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authUrl: (state) => 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    }).toString(),
    exchange: exchangeGoogleCode
  },
  github: {
    label: 'GitHub',
    configured: () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    authUrl: (state) => 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
      state
    }).toString(),
    exchange: exchangeGithubCode
  }
};

Object.entries(PROVIDERS).forEach(([key, provider]) => {
  // Start: full-page redirect to the provider.
  router.get(`/${key}`, (req, res) => {
    if (!provider.configured()) {
      return res.status(501).json({ error: `${provider.label} sign-in is not configured on this server.` });
    }
    res.redirect(provider.authUrl(createState()));
  });

  // Callback: sign in / register, or (when state carries linkUserId) link.
  router.get(`/${key}/callback`, async (req, res) => {
    const { code, state, error } = req.query;
    let linkUserId = null;
    let stateOk = false;
    try {
      if (state) { const payload = verifyState(String(state)); linkUserId = payload.linkUserId || null; stateOk = true; }
    } catch { /* invalid/expired state handled below */ }

    const fail = (msg) => res.redirect(
      linkUserId
        ? `${frontendUrl()}/settings?authError=${encodeURIComponent(msg)}`
        : `${frontendUrl()}/login?error=${encodeURIComponent(msg)}`
    );

    if (error) {
      return fail(error === 'access_denied'
        ? `${provider.label} authentication was cancelled.`
        : `Unable to sign in with ${provider.label}. Please try again.`);
    }
    if (!code || !stateOk) {
      return fail('Your session has expired. Please sign in again.');
    }

    try {
      const profile = await provider.exchange(String(code));
      if (linkUserId) {
        await linkProviderToUser(linkUserId, key, profile);
        return res.redirect(`${frontendUrl()}/settings?linked=${key}`);
      }
      const user = await findOrCreateOAuthUser(key, profile);
      return res.redirect(`${frontendUrl()}/auth/callback#token=${encodeURIComponent(signToken(user))}`);
    } catch (err) {
      console.error(`${provider.label} OAuth error:`, err.message);
      return fail(err.userMessage || `Unable to sign in with ${provider.label}. Please try again.`);
    }
  });
});

// ---------------------------------------------------------------------------
// Login methods for a signed-in user (Settings > Login methods)
// ---------------------------------------------------------------------------

// POST /api/auth/link/:provider -> { url }  (frontend then navigates to it)
router.post('/link/:provider', requireAuth, (req, res) => {
  const provider = PROVIDERS[req.params.provider];
  if (!provider) return res.status(404).json({ error: 'Unknown login provider.' });
  if (!provider.configured()) {
    return res.status(501).json({ error: `${provider.label} sign-in is not configured on this server.` });
  }
  const state = createState({ linkUserId: String(req.user._id) });
  res.json({ url: provider.authUrl(state) });
});

// DELETE /api/auth/link/:provider — never removes the last usable login method.
router.delete('/link/:provider', requireAuth, asyncH(async (req, res) => {
  const key = req.params.provider;
  if (!PROVIDERS[key]) return res.status(404).json({ error: 'Unknown login provider.' });
  const user = req.user;
  if (!user.providers?.[key]) return res.status(400).json({ error: `${PROVIDERS[key].label} is not connected.` });

  const methods = (user.passwordHash ? 1 : 0)
    + Object.keys(PROVIDERS).filter((k) => user.providers?.[k]).length;
  if (methods <= 1) {
    return res.status(400).json({ error: 'You cannot remove your only login method.' });
  }
  user.providers[key] = undefined;
  user.markModified('providers');
  await user.save();
  res.json({ user: publicUser(user) });
}));

// ---------------------------------------------------------------------------
// Enterprise SSO — architecture stub.
//
// Real multi-tenant SSO (SAML or OIDC-per-workspace) needs each customer's
// Identity Provider metadata (issuer URL, certs, entity IDs), which doesn't
// exist yet for KeyNova. Rather than fake a login, this endpoint documents
// exactly how to wire it up later:
//
//   1. Add a `Workspace` model: { domain, ssoType: 'oidc'|'saml', issuer,
//      clientId, clientSecret (oidc) OR idpCertificate/entityId (saml) }.
//   2. On POST /api/auth/sso/init, look up the workspace by the email
//      domain the user typed, then:
//        - OIDC: use `openid-client` to discover the issuer and redirect
//          into its authorization endpoint (same code-exchange pattern as
//          Google/GitHub above).
//        - SAML: use `@node-saml/node-saml` to build and redirect an
//          AuthnRequest, then verify the POSTed assertion in the callback.
//   3. On callback, find-or-create the KeyNova user exactly like
//      findOrCreateOAuthUser() does for Google/GitHub, keyed by
//      `providers.sso_<workspaceId>`.
//
// Until a workspace is configured, this returns a clear, honest message
// instead of a fake success.
// ---------------------------------------------------------------------------
router.post('/sso/init', async (req, res) => {
  res.status(501).json({
    error: 'Enterprise SSO is not configured for this workspace yet. Contact your administrator.'
  });
});

module.exports = router;
