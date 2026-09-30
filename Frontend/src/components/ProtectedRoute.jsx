import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

// Guards routes that require a backend-backed session (Tournaments,
// Notifications). Dashboard/TypingTest/Practice/Statistics work fully
// client-side and stay open to guests, matching how the original
// localStorage-only app behaved.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="empty-state"><Logo size={64} className="kn-logo-pulse" priority /><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
