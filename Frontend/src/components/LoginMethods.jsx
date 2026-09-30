import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as authService from '../services/authService';

const SOCIAL = [
  { key: 'google', label: 'Google' },
  { key: 'github', label: 'GitHub' },
];

/**
 * Settings > Account > Login methods.
 * Shows which sign-in methods are attached to this KeyNova account and lets
 * the user connect / disconnect Google and GitHub. The backend refuses to
 * remove the last usable method, and this UI mirrors that rule.
 */
export default function LoginMethods() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [providers, setProviders] = useState({ google: false, github: false });
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    authService.fetchAuthProviders().then(setProviders);
  }, []);

  // Result of the provider redirect (?linked=google or ?authError=...)
  useEffect(() => {
    const linked = params.get('linked');
    const err = params.get('authError');
    if (!linked && !err) return;
    if (err) showToast(err);
    if (linked) {
      authService.fetchMe()
        .then((u) => {
          refreshUser(u);
          const label = SOCIAL.find((s) => s.key === linked)?.label || 'Login method';
          showToast(`${label} connected.`);
        })
        .catch(() => showToast('Connected, but the page could not refresh. Please reload.'));
    }
    params.delete('linked');
    params.delete('authError');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linked = user?.linkedProviders || {};
  const methodCount = (user?.hasPassword ? 1 : 0) + SOCIAL.filter((s) => linked[s.key]).length;

  const connect = async (key) => {
    setBusy(key);
    try {
      const url = await authService.startLink(key);
      window.location.href = url; // leaves the SPA for the provider
    } catch (err) {
      showToast(err.friendlyMessage || 'Could not start the connection. Please try again.');
      setBusy(null);
    }
  };

  const disconnect = async (key, label) => {
    if (!window.confirm(`Disconnect ${label} from your KeyNova account?`)) return;
    setBusy(key);
    try {
      const updated = await authService.unlinkProvider(key);
      refreshUser(updated);
      showToast(`${label} disconnected.`);
    } catch (err) {
      showToast(err.friendlyMessage || `Could not disconnect ${label}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="login-methods" aria-label="Login methods">
      <div className="login-method">
        <div>
          <div className="lm-name">Email &amp; password</div>
          <div className={`lm-status ${user?.hasPassword ? 'ok' : ''}`}>
            {user?.hasPassword ? '✓ Connected' : 'Not set'}
          </div>
        </div>
      </div>

      {SOCIAL.map(({ key, label }) => {
        const isLinked = !!linked[key];
        const canRemove = isLinked && methodCount > 1;
        return (
          <div className="login-method" key={key}>
            <div>
              <div className="lm-name">{label}</div>
              <div className={`lm-status ${isLinked ? 'ok' : ''}`}>
                {isLinked ? '✓ Connected' : providers[key] ? 'Not connected' : 'Not configured on this server'}
              </div>
            </div>
            {isLinked ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!canRemove || busy === key}
                title={canRemove ? '' : 'You cannot remove your only login method'}
                onClick={() => disconnect(key, label)}
              >
                {busy === key ? 'Working…' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!providers[key] || busy === key}
                onClick={() => connect(key)}
              >
                {busy === key ? 'Redirecting…' : 'Connect'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
