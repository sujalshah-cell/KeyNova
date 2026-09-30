import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { getPrefs, applyPrefsToDocument } from './utils/prefs.js';
import './styles/global.css';

// Fixes a previous bug: dark mode / background theme / font / density were
// only ever applied inside Settings.jsx's onChange handlers, so a hard
// refresh silently reset the visible UI to defaults even though the
// preference was still sitting in localStorage. Applying it once here,
// before the first paint, makes every preference survive a refresh.
applyPrefsToDocument(getPrefs());

createRoot(document.getElementById('root')).render(
  // NOTE: <StrictMode> is intentionally not used. The typing engine updates
  // counters (WPM/accuracy refs) inside setState updater functions, which
  // StrictMode runs twice in development and would double-count keystrokes.
  <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
  </BrowserRouter>
);
