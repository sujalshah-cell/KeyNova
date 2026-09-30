import { useEffect, useState } from 'react';
import * as notificationService from '../services/notificationService';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '../services/endpoints';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const { socket } = useSocket();

  useEffect(() => {
    notificationService.fetchNotifications()
      .then(setItems)
      .catch((err) => { setError(err.friendlyMessage); setItems([]); });
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (n) => setItems((prev) => [n, ...(prev || [])]);
    socket.on(SOCKET_EVENTS.notification, onNew);
    return () => socket.off(SOCKET_EVENTS.notification, onNew);
  }, [socket]);

  const onMarkRead = async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id || n.id === id ? { ...n, read: true } : n)));
    try { await notificationService.markRead(id); } catch { /* already optimistically marked read locally */ }
  };

  return (
    <>
      <div className="view-header">
        <h2>Notifications</h2>
        <p>Room invites, joins, and race updates.</p>
      </div>

      {error && <div className="empty-state"><div className="ic">⚠</div><p>{error}</p></div>}
      {!error && items?.length === 0 && (
        <div className="empty-state"><div className="ic">🔔</div><p>You're all caught up.</p></div>
      )}
      {!error && items?.length > 0 && (
        <div className="card settings-card">
          {items.map((n) => (
            <div className="settings-row" key={n._id || n.id}>
              <div>
                <h4>{n.title || n.message}</h4>
                {n.title && n.message && <p>{n.message}</p>}
                <p style={{ marginTop: 4 }}>{new Date(n.createdAt || n.date).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button className="btn btn-secondary btn-sm" onClick={() => onMarkRead(n._id || n.id)}>Mark read</button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
