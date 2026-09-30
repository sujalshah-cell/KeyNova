import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

// Landing point for GET /api/auth/google/callback and /github/callback,
// which redirect here as `${FRONTEND_URL}/auth/callback?token=...` once the
// backend has already verified the provider and minted a KeyNova JWT.
export default function AuthCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // The backend puts the token in the URL fragment (#token=...) so it never
    // reaches a server log; the query string is still accepted for older links.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hash.get('token') || params.get('token');
    // Remove the token from the address bar / history right away.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setError('No sign-in token was returned. Please try again.');
      return;
    }
    loginWithToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('We could not complete sign-in. Please try again.'));
  }, [params, loginWithToken, navigate]);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <p className="form-error">{error}</p>
          <a className="btn btn-primary btn-block" href="/login" style={{ marginTop: 16 }}>Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <Logo size={64} className="kn-logo-pulse" priority />
        <p className="auth-sub">Finishing sign-in…</p>
      </div>
    </div>
  );
}
