import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TypingTest from './pages/TypingTest.jsx';
import Practice from './pages/Practice.jsx';
import Tournaments from './pages/Tournaments.jsx';
import Room from './pages/Room.jsx';
import Statistics from './pages/Statistics.jsx';
import Settings from './pages/Settings.jsx';
import Notifications from './pages/Notifications.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AuthCallback from './pages/AuthCallback.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/typing-test" element={<TypingTest />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/tournaments" element={<ProtectedRoute><Tournaments /></ProtectedRoute>} />
          <Route path="/tournaments/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </>
  );
}
