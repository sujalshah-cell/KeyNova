import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as authService from '../services/authService';
import PasswordField from '../components/PasswordField';
import Logo from '../components/Logo';
import api from '../services/api';
import { AUTH } from '../services/endpoints';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // 'providers' = the Google/Email/SSO chooser, 'email' = the classic form
  const [view, setView] = useState('providers');
  const [showMore, setShowMore] = useState(false);
  const [showSso, setShowSso] = useState(false);
  const [providers, setProviders] = useState({ google: true, github: false, sso: false });

  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [ssoDomain, setSsoDomain] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(null); // 'google' | 'github' | null

  useEffect(() => {
    authService.fetchAuthProviders().then(setProviders);
  }, []);

  // The backend redirects failed Google/GitHub attempts back here with
  // ?error=... so the failure is explained instead of silently vanishing.
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(err);
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmitEmail = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: form.email, password: form.password, remember: form.remember });
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.friendlyMessage || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  // If the user comes back with the browser Back button (bfcache) after
  // cancelling on the provider page, restore the buttons.
  useEffect(() => {
    const restore = (e) => { if (e.persisted) setOauthBusy(null); };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const onGoogle = () => {
    if (oauthBusy) return; // prevent duplicate auth requests
    if (!providers.google) {
      showToast('Google sign-in is not configured on this server yet.');
      return;
    }
    setError(null);
    setOauthBusy('google');
    authService.goToGoogleLogin();
  };

  const onGithub = () => {
    if (oauthBusy) return;
    if (!providers.github) {
      showToast('GitHub sign-in is not configured on this server yet.');
      return;
    }
    setError(null);
    setOauthBusy('github');
    authService.goToGithubLogin();
  };

  const onSsoSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(AUTH.ssoInit, { domain: ssoDomain });
    } catch (err) {
      setError(err.friendlyMessage || 'Enterprise SSO is not configured for this workspace yet.');
    }
  };

  const onForgotPassword = (e) => {
    e.preventDefault();
    showToast("Password reset isn't set up yet — contact support for now.");
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-brand">
          <Logo size={64} priority />
        </div>

        {view === 'providers' && (
          <>
            <h2 className="auth-title">Log in to KeyNova</h2>
            {error && <div className="form-error" role="alert">{error}</div>}

            <div className="auth-providers">
              <button type="button" className="btn btn-provider" onClick={onGoogle} disabled={!!oauthBusy} aria-busy={oauthBusy === 'google'}>
                <GoogleIcon /> {oauthBusy === 'google' ? 'Signing in with Google…' : 'Continue with Google'}
              </button>
              <button type="button" className="btn btn-provider" onClick={() => setView('email')}>
                <span className="provider-ic" aria-hidden>✉</span> Continue with Email
              </button>
              <button type="button" className="btn btn-provider" onClick={() => setShowSso((s) => !s)} aria-expanded={showSso}>
                <span className="provider-ic" aria-hidden>🏢</span> Use SSO
              </button>
            </div>

            {showSso && (
              <form className="sso-panel" onSubmit={onSsoSubmit}>
                <label htmlFor="sso-domain">Company email domain</label>
                <div className="sso-row">
                  <input
                    id="sso-domain"
                    type="text"
                    placeholder="yourcompany.com"
                    value={ssoDomain}
                    onChange={(e) => setSsoDomain(e.target.value)}
                    required
                  />
                  <button className="btn btn-secondary btn-sm" type="submit">Continue</button>
                </div>
              </form>
            )}

            <button type="button" className="link-btn view-more" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              {showMore ? 'Hide options' : 'View more options'}
            </button>

            {showMore && (
              <div className="auth-providers auth-providers-more">
                <button type="button" className="btn btn-provider" onClick={onGithub} disabled={!providers.github || !!oauthBusy}>
                  <span className="provider-ic" aria-hidden>🐙</span> {oauthBusy === 'github' ? 'Signing in with GitHub…' : 'Continue with GitHub'}
                  {!providers.github && <span className="coming-soon">Not configured</span>}
                </button>
                <button type="button" className="btn btn-provider" disabled title="Coming soon">
                  <span className="provider-ic" aria-hidden></span> Continue with Microsoft
                  <span className="coming-soon">Coming soon</span>
                </button>
                <button type="button" className="btn btn-provider" disabled title="Coming soon">
                  <span className="provider-ic" aria-hidden></span> Continue with Apple
                  <span className="coming-soon">Coming soon</span>
                </button>
              </div>
            )}

            <p className="auth-switch">New to KeyNova? <Link to="/register">Create account</Link></p>
          </>
        )}

        {view === 'email' && (
          <form onSubmit={onSubmitEmail}>
            <button type="button" className="link-btn back-btn" onClick={() => { setView('providers'); setError(null); }}>
              ← Back
            </button>
            <h2 className="auth-title">Log in with email</h2>
            {error && <div className="form-error" role="alert">{error}</div>}

            <label htmlFor="login-email">Email
              <input
                id="login-email" type="email" name="email" required autoComplete="email"
                value={form.email} onChange={onChange} placeholder="you@example.com"
              />
            </label>

            <PasswordField
              label="Password" name="password" autoComplete="current-password"
              value={form.password} onChange={onChange} placeholder="••••••••"
            />

            <div className="auth-row-between">
              <label className="checkbox-inline">
                <input type="checkbox" name="remember" checked={form.remember} onChange={onChange} />
                Remember me
              </label>
              <button type="button" className="link-btn" onClick={onForgotPassword}>Forgot password?</button>
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>

            <p className="auth-switch">Don't have an account? <Link to="/register">Create account</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg className="provider-ic" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.79 2.73v2.27h2.9c1.7-1.56 2.69-3.87 2.69-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.9-2.27c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l2.99-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
