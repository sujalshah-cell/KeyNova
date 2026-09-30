import { Link, NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');

  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="KeyNova home">
        <Logo size={44} className="brand-logo" priority />
        <span className="brand-name">KeyNova</span>
      </Link>
      <nav className="nav">
        <NavLink to="/" end className={link}>Dashboard</NavLink>
        <NavLink to="/typing-test" className={link}>Typing Test</NavLink>
        <NavLink to="/practice" className={link}>Practice</NavLink>
        <NavLink to="/tournaments" className={link}>Tournaments</NavLink>
        <NavLink to="/statistics" className={link}>Statistics</NavLink>
        <NavLink to="/settings" className={link}>Settings</NavLink>
        {user && <NavLink to="/notifications" className={link} aria-label="Notifications">🔔</NavLink>}
      </nav>
      <div className="topbar-actions">
        {user ? (
          <>
            <span className="user-chip">{user.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>Log in</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>Sign up</button>
          </>
        )}
      </div>
    </header>
  );
}
