import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const persist = (t, u) => {
    if (t) localStorage.setItem('tf_token', t); else localStorage.removeItem('tf_token');
    if (u) localStorage.setItem('tf_user', JSON.stringify(u)); else localStorage.removeItem('tf_user');
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
        if (!cancelled) setUser(freshUser);
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
    if (!user?.settings) return;
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

  const refreshUser = useCallback((patch) => {
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
