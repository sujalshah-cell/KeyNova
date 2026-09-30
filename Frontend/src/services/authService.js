import api from './api';
import { AUTH } from './endpoints';

export async function register({ username, email, password }) {
  const { data } = await api.post(AUTH.register, { username, email, password });
  return data; // { token, user }
}

// IMPORTANT: `password` here is always the raw, user-entered password.
// It must never be bcrypt-hashed on the client — the backend hashes on
// register and compares with bcrypt.compare on login.
export async function login({ email, password, remember = true }) {
  const { data } = await api.post(AUTH.login, { email, password, remember });
  return data; // { token, user }
}

export async function fetchMe() {
  const { data } = await api.get(AUTH.me);
  return data.user ?? data;
}

// Fixed: backend exposes this as PUT, not PATCH.
export async function updateSettings(settings) {
  const { data } = await api.put(AUTH.updateSettings, settings);
  return data.user ?? data;
}

export async function fetchAuthProviders() {
  try {
    const { data } = await api.get(AUTH.providers);
    return data; // { google, github, sso }
  } catch {
    // If this ever fails, fail closed: show only Email, never a button that 500s.
    return { google: false, github: false, sso: false };
  }
}

// These are full-page navigations, not XHR — the browser needs to leave the
// SPA to reach Google/GitHub's consent screen, so we don't go through axios.
export function goToGoogleLogin() {
  window.location.href = `${api.defaults.baseURL}${AUTH.googleStart}`;
}

export function goToGithubLogin() {
  window.location.href = `${api.defaults.baseURL}${AUTH.githubStart}`;
}

// Settings > Login methods: start linking a provider to the signed-in account.
// Returns the provider URL to navigate to.
export async function startLink(provider) {
  const { data } = await api.post(AUTH.link(provider));
  return data.url;
}

export async function unlinkProvider(provider) {
  const { data } = await api.delete(AUTH.link(provider));
  return data.user ?? data;
}
