import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as roomService from '../services/roomService';
import { useToast } from '../context/ToastContext';

/**
 * Room-based tournament system: Create Room / Join Room with a 6-char code
 * + password, max players, and a choice of race format. Paths verified
 * against the real Backend/routes/rooms.js (see services/roomService.js).
 * Backend/utils/texts.js already supports mode: 'time' | 'custom' | 'quote'
 * | 'code' | 'words' — this form now exposes all of them.
 */
export default function Tournaments() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [createForm, setCreateForm] = useState({
    mode: 'time',
    value: 60,        // duration (seconds) when mode === 'time'
    wordCount: 100,    // word count when mode === 'words'
    password: '',
    maxPlayers: 10,
    customText: ''
  });
  const [joinForm, setJoinForm] = useState({ roomId: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onCreate = async (e) => {
    e.preventDefault();
    setError(null);

    if (createForm.mode === 'custom' && createForm.customText.trim().length < 20) {
      setError('Your custom text should be at least 20 characters.');
      return;
    }

    setBusy(true);
    try {
      const room = await roomService.createRoom({
        mode: createForm.mode,
        duration: createForm.mode === 'time' ? Number(createForm.value) : 60,
        wordCount: createForm.mode === 'words' ? Number(createForm.wordCount) : undefined,
        password: createForm.password,
        maxPlayers: Number(createForm.maxPlayers),
        customText: createForm.mode === 'custom' ? createForm.customText.trim() : ''
      });
      showToast(`Room created — code ${room.roomId}. Share the code and password with friends.`);
      navigate(`/tournaments/${room.roomId}`);
    } catch (err) {
      setError(err.friendlyMessage || 'Could not create the room.');
    } finally { setBusy(false); }
  };

  const onJoin = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const room = await roomService.joinRoom(joinForm.roomId.trim(), joinForm.password);
      navigate(`/tournaments/${room.roomId || joinForm.roomId.trim().toUpperCase()}`);
    } catch (err) {
      setError(err.friendlyMessage || 'Could not join that room.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="view-header">
        <h2>Tournaments</h2>
        <p>Create a private race room or join one with an invite code.</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="tourn-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <form className="card" style={{ padding: 24 }} onSubmit={onCreate}>
          <h3 style={{ marginBottom: 6 }}>Create a room</h3>
          <p className="modal-sub" style={{ marginBottom: 18 }}>You'll get an invite to share — room owner is notified when someone joins.</p>

          <label>Race format
            <select className="select-mini" style={{ width: '100%', marginTop: 6 }}
              value={createForm.mode} onChange={(e) => setCreateForm((f) => ({ ...f, mode: e.target.value }))}>
              <option value="time">Timed race (random words)</option>
              <option value="words">Fixed word count</option>
              <option value="custom">Custom text / paragraph</option>
              <option value="quote">Random quote</option>
              <option value="code">Code snippet</option>
            </select>
          </label>

          {createForm.mode === 'time' && (
            <label style={{ marginTop: 14, display: 'block' }}>Duration (seconds)
              <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="number" min="15" max="180"
                value={createForm.value} onChange={(e) => setCreateForm((f) => ({ ...f, value: e.target.value }))} />
            </label>
          )}

          {createForm.mode === 'words' && (
            <label style={{ marginTop: 14, display: 'block' }}>Number of words
              <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="number" min="20" max="300"
                value={createForm.wordCount} onChange={(e) => setCreateForm((f) => ({ ...f, wordCount: e.target.value }))} />
            </label>
          )}

          {createForm.mode === 'custom' && (
            <label style={{ marginTop: 14, display: 'block' }}>Race text
              <textarea
                style={{ width: '100%', marginTop: 6, minHeight: 100, fontFamily: 'var(--font-mono)', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                maxLength={4000}
                placeholder="Paste or write the paragraph everyone will race to type…"
                value={createForm.customText}
                onChange={(e) => setCreateForm((f) => ({ ...f, customText: e.target.value }))}
              />
              <span className="modal-sub" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                {createForm.customText.trim().length} / 4000 characters
              </span>
            </label>
          )}

          {createForm.mode === 'quote' && (
            <p className="modal-sub" style={{ marginTop: 14 }}>A random inspirational quote will be picked when the race starts.</p>
          )}
          {createForm.mode === 'code' && (
            <p className="modal-sub" style={{ marginTop: 14 }}>A random short code snippet will be picked when the race starts.</p>
          )}

          <label style={{ marginTop: 14, display: 'block' }}>Max players
            <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="number" min="2" max="10"
              value={createForm.maxPlayers} onChange={(e) => setCreateForm((f) => ({ ...f, maxPlayers: e.target.value }))} />
          </label>

          <label style={{ marginTop: 14, display: 'block' }}>Room password
            <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="text" required
              value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Shared with invitees" />
          </label>

          <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={busy}>
            {busy ? 'Creating…' : 'Create room'}
          </button>
        </form>

        <form className="card" style={{ padding: 24 }} onSubmit={onJoin}>
          <h3 style={{ marginBottom: 6 }}>Join a room</h3>
          <p className="modal-sub" style={{ marginBottom: 18 }}>Enter the room ID and password a friend shared with you.</p>

          <label>Room ID
            <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="text" required
              value={joinForm.roomId} onChange={(e) => setJoinForm((f) => ({ ...f, roomId: e.target.value }))} placeholder="e.g. A1B2C3" />
          </label>
          <label style={{ marginTop: 14, display: 'block' }}>Password
            <input className="select-mini" style={{ width: '100%', marginTop: 6 }} type="text" required
              value={joinForm.password} onChange={(e) => setJoinForm((f) => ({ ...f, password: e.target.value }))} />
          </label>

          <button className="btn btn-secondary btn-block" style={{ marginTop: 20 }} disabled={busy}>
            {busy ? 'Joining…' : 'Join room'}
          </button>
        </form>
      </div>
    </>
  );
}