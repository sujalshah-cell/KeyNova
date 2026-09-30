import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const TYPE_CARDS = [
  { mode: 'time', value: 60, icon: '⏱', label: '60s Time' },
  { mode: 'time', value: 30, icon: '⏱', label: '30s Time' },
  { mode: 'words', value: 100, icon: '✎', label: '100 Words' },
  { mode: 'quote', value: '', icon: '"', label: 'Quote' },
  { mode: 'custom', value: '', icon: '✐', label: 'Custom' },
  { mode: 'code', value: '', icon: '</>', label: 'Code' },
  { mode: 'zen', value: '', icon: '∞', label: 'Zen' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Signed-in users see their real stats/streak from the account object
  // returned at login (matches the Postman response you shared). Guests
  // see placeholders — there is no backend data to show them.
  const stats = user?.stats;
  const streak = user?.streak;

  const goToTest = (mode, value) => navigate('/typing-test', { state: { mode, value } });

  return (
    <>
      <section className="hero">
        <div className="hero-chip chip-a">A</div>
        <div className="hero-chip chip-enter">⏎</div>
        <div className="hero-chip chip-k">K</div>
        <div className="hero-chip chip-code">{'{ }'}</div>
        <Logo size={160} className="hero-logo" priority />
        <h1>Test your typing skills</h1>
        <p className="hero-sub">Improve your speed, accuracy, rhythm, and keyboard confidence.</p>

        <div className="stat-grid">
          <div className="stat-card"><div className="num">{stats ? stats.bestWpm : '–'}</div><div className="label">Best WPM</div></div>
          <div className="stat-card"><div className="num">{stats ? `${stats.avgAccuracy}%` : '–'}</div><div className="label">Avg Accuracy</div></div>
          <div className="stat-card"><div className="num">{stats ? stats.testsCompleted : '–'}</div><div className="label">Tests Completed</div></div>
          <div className="stat-card"><div className="num">{stats ? stats.totalChars : '–'}</div><div className="label">Total Characters</div></div>
        </div>

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => goToTest('time', 30)}>Start Typing</button>
          <button className="btn btn-secondary" onClick={() => goToTest('custom', '')}>Customize Test</button>
        </div>
      </section>

      <div className="type-grid">
        {TYPE_CARDS.map((c) => (
          <button key={c.label} className="type-card" onClick={() => goToTest(c.mode, c.value)}>
            <span className="ic">{c.icon}</span> {c.label}
          </button>
        ))}
        <button className="type-card" onClick={() => navigate('/practice')}><span className="ic">📊</span> Practice</button>
      </div>

      {user ? (
        <div className="card challenge">
          <div className="challenge-top">
            <div>
              <h3>Your streak</h3>
              <p className="challenge-meta">
                Last test: {streak?.lastTestDate ? new Date(streak.lastTestDate).toLocaleDateString() : 'No tests yet'}
              </p>
            </div>
            <div className="challenge-actions">
              <div className="streak"><span className="flame">🔥</span> {streak?.current ?? 0} day streak</div>
              <button className="btn btn-primary btn-sm" onClick={() => goToTest('time', 60)}>Keep it going</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card challenge">
          <div className="challenge-top">
            <div>
              <h3>Track your progress</h3>
              <p className="challenge-meta">Log in to save your stats, build a streak, and join tournaments.</p>
            </div>
            <div className="challenge-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>Sign up free</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
