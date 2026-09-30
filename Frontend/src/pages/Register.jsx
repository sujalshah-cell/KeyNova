import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import Logo from '../components/Logo';
import * as authService from '../services/authService';
import { GoogleIcon } from './Login';

function passwordHint(pw) {
  if (!pw) return null;
  if (pw.length < 6) return { level: 'weak', text: 'At least 6 characters' };
  if (pw.length < 10 || !/[0-9]/.test(pw)) return { level: 'okay', text: 'Good — add a number for extra strength' };
  return { level: 'strong', text: 'Strong password' };
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [oauthBusy, setOauthBusy] = useState(null);

  useEffect(() => {
    authService.fetchAuthProviders().then(setProviders);
  }, []);

  // Restore buttons if the user returns via the Back button after cancelling.
  useEffect(() => {
    const restore = (e) => { if (e.persisted) setOauthBusy(null); };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const startOAuth = (which) => {
    if (oauthBusy) return;
    setError(null);
    setOauthBusy(which);
    if (which === 'google') authService.goToGoogleLogin();
    else authService.goToGithubLogin();
  };

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const hint = passwordHint(form.password);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Only username/email/password are sent — the backend hashes it
      // exactly once, at registration time.
      await register({ username: form.username, email: form.email, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.friendlyMessage || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="auth-brand"><Logo size={64} priority /></div>
        <h2 className="auth-title">Create your KeyNova account</h2>
        <p className="auth-sub">Track your progress and join tournaments.</p>
        {error && <div className="form-error" role="alert">{error}</div>}

        {(providers.google || providers.github) && (
          <>
            <div className="auth-providers">
              {providers.google && (
                <button type="button" className="btn btn-provider" onClick={() => startOAuth('google')} disabled={!!oauthBusy} aria-busy={oauthBusy === 'google'}>
                  <GoogleIcon /> {oauthBusy === 'google' ? 'Signing in with Google…' : 'Continue with Google'}
                </button>
              )}
              {providers.github && (
                <button type="button" className="btn btn-provider" onClick={() => startOAuth('github')} disabled={!!oauthBusy} aria-busy={oauthBusy === 'github'}>
                  <span className="provider-ic" aria-hidden>🐙</span> {oauthBusy === 'github' ? 'Signing in with GitHub…' : 'Continue with GitHub'}
                </button>
              )}
            </div>
            <div className="auth-divider" role="separator"><span>or sign up with email</span></div>
          </>
        )}

        <label htmlFor="reg-username">Username
          <input
            id="reg-username" type="text" name="username" required minLength={3} maxLength={20}
            value={form.username} onChange={onChange} placeholder="speedtyper" autoComplete="username"
          />
        </label>

        <label htmlFor="reg-email">Email
          <input
            id="reg-email" type="email" name="email" required autoComplete="email"
            value={form.email} onChange={onChange} placeholder="you@example.com"
          />
        </label>

        <PasswordField
          label="Password" name="password" autoComplete="new-password" minLength={6}
          value={form.password} onChange={onChange} placeholder="At least 6 characters"
        />
        {hint && <p className={`password-hint hint-${hint.level}`}>{hint.text}</p>}

        <PasswordField
          label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={6}
          value={form.confirmPassword} onChange={onChange} placeholder="Re-enter your password"
        />

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
