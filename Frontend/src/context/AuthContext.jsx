import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as authService from '../services/authService';
import { getPrefs, savePrefs, applyPrefsToDocument, fromBackendSettings } from '../utils/prefs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('tf_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('tf_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // The user object cached in localStorage can be out of date (settings
  // changed on another device, or just before the page was closed). Settings
  // from it must NOT overwrite this device's newest local preferences, so we
  // only fold account settings into local prefs once they have come from the
  // server in this session (login / register / /auth/me / settings save).
  const settingsFreshRef = useRef(false);

  // Settings object that came back from this device's OWN save. It is only a
  // confirmation: this device already shows those choices, and an older reply
  // arriving late (slow network / remote database) must never repaint the page
  // with a previous theme or colour. The merge effect skips it.
  const ownSaveSettingsRef = useRef(null);

  const persist = (t, u) => {
    if (t) localStorage.setItem('tf_token', t); else localStorage.removeItem('tf_token');
    if (u) localStorage.setItem('tf_user', JSON.stringify(u)); else localStorage.removeItem('tf_user');
    settingsFreshRef.current = Boolean(u); // login/register data comes straight from the server
    setToken(t); setUser(u);
  };

  // Try to rehydrate the session on load. Endpoint is INFERRED (AUTH.me) —
  // if it 404s we just fall back to whatever was cached locally, so a wrong
  // guess here degrades gracefully instead of breaking the app.
  useEffect(() => {
    let cancelled = false;
    async function rehydrate() {
      if (!token) { setLoading(false); return; }
      try {
        const freshUser = await authService.fetchMe();
        if (!cancelled) {
          // Keep the cache in step with the server copy, then allow the
          // account settings to be merged into local prefs.
          localStorage.setItem('tf_user', JSON.stringify(freshUser));
          settingsFreshRef.current = true;
          setUser(freshUser);
        }
      } catch (err) {
        // Expired/invalid token -> sign out cleanly instead of showing a
        // half-logged-in state. Network errors keep the cached user.
        if (err?.response?.status === 401 && !cancelled) persist(null, null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    rehydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever we have a signed-in user with settings from the server, fold
  // them into local device prefs so appearance (theme, background,
  // typing effect, etc.) follows the account across browsers/devices
  // instead of only ever living in this browser's localStorage.
  useEffect(() => {
    if (!user?.settings || !settingsFreshRef.current) return;
    if (ownSaveSettingsRef.current === user.settings) return;
    const merged = { ...getPrefs(), ...fromBackendSettings(user.settings) };
    savePrefs(merged);
    applyPrefsToDocument(merged);
  }, [user?.settings]);

  const register = useCallback(async (form) => {
    setAuthError(null);
    const data = await authService.register(form);
    persist(data.token, data.user);
    return data.user;
  }, []);

  const login = useCallback(async (form) => {
    setAuthError(null);
    const data = await authService.login(form);
    persist(data.token, data.user);
    return data.user;
  }, []);

  // Used by /auth/callback after Google/GitHub redirect back with a
  // KeyNova JWT already minted server-side (see routes/auth.js). We just
  // need to store it and fetch the profile — no password ever touches
  // the frontend for OAuth logins.
  const loginWithToken = useCallback(async (t) => {
    setAuthError(null);
    localStorage.setItem('tf_token', t);
    setToken(t);
    try {
      const freshUser = await authService.fetchMe();
      persist(t, freshUser);
      return freshUser;
    } catch (err) {
      persist(null, null);
      throw err;
    }
  }, []);

  const logout = useCallback(() => persist(null, null), []);

  // refreshUser(patch, { ownSave: true }) -> the patch is the reply to a settings
  // save made on this device: keep the cached user in step, but do not merge it
  // back into the visible preferences.
  const refreshUser = useCallback((patch, options) => {
    if (patch && patch.settings) {
      if (options && options.ownSave) ownSaveSettingsRef.current = patch.settings;
      else settingsFreshRef.current = true;
    }
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('tf_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, authError, setAuthError, register, login, loginWithToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}