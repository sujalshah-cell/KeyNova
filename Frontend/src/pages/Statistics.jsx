import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as statsService from '../services/statsService';

export default function Statistics() {
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) { setHistory([]); return; }
    statsService.fetchHistory()
      .then(setHistory)
      .catch((err) => { setError(err.friendlyMessage); setHistory([]); });
  }, [user]);

  const stats = user?.stats;

  return (
    <>
      <div className="view-header">
        <h2>Statistics</h2>
        <p>Your typing history, trends, and personal bests.</p>
      </div>

      {!user && (
        <div className="empty-state"><div className="ic">📊</div><p>Log in to see your saved statistics and history.</p></div>
      )}

      {user && (
        <>
          <div className="stats-summary">
            <div className="stat-card"><div className="num">{stats?.bestWpm ?? '–'}</div><div className="label">Best WPM</div></div>
            <div className="stat-card"><div className="num">{stats?.avgWpm ?? '–'}</div><div className="label">Average WPM</div></div>
            <div className="stat-card"><div className="num">{stats ? `${stats.avgAccuracy}%` : '–'}</div><div className="label">Avg Accuracy</div></div>
            <div className="stat-card"><div className="num">{stats?.testsCompleted ?? '–'}</div><div className="label">Tests Taken</div></div>
          </div>

          <div className="card" id="history-card">
            {error && <div className="empty-state"><div className="ic">⚠</div><p>{error}</p></div>}
            {!error && history?.length === 0 && (
              <div className="empty-state"><div className="ic">📝</div><p>No tests yet — your history will show up here.</p></div>
            )}
            {!error && history?.length > 0 && (
              <table className="history-table">
                <thead><tr><th>Date</th><th>Mode</th><th>WPM</th><th>Accuracy</th><th>Characters</th><th>Consistency</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h._id || i}>
                      <td>{new Date(h.date || h.createdAt).toLocaleString()}</td>
                      <td>{h.mode}</td><td>{h.wpm}</td><td>{h.accuracy}%</td><td>{h.chars}</td><td>{h.consistency}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
