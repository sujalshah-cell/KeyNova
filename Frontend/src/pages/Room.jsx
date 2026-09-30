import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

import * as roomService from '../services/roomService';
import { SOCKET_EVENTS } from '../services/endpoints';
import { playKeySound, playCountdownBeep, playGoBeep } from '../utils/sound';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { showToast } = useToast();

  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  const [countdown, setCountdown] = useState(null);
  const [starting, setStarting] = useState(false);

  const [players, setPlayers] = useState({});
  const [raceText, setRaceText] = useState('');
  const [pos, setPos] = useState(0);
  const [finished, setFinished] = useState(false);

  const [now, setNow] = useState(Date.now());

  const joinedRoomRef = useRef(null);

  const startTsRef = useRef(0);
  const correctRef = useRef(0);
  const totalRef = useRef(0);

  /*
   * ---------------------------------------------------------
   * LOAD ROOM
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function loadRoom() {
      try {
        console.log('[room] loading:', roomId);

        const result = await roomService.getRoom(roomId);

        if (cancelled) return;

        console.log('[room] loaded:', result);

        setRoom(result);

        const map = {};

        (result.participants || []).forEach((participant) => {
          map[String(participant.userId)] = participant;
        });

        setPlayers(map);

        // Recover race text on a hard refresh / fresh load that lands
        // mid-race, since room:go only ever fires once and may have
        // happened before this page existed.
        if (result.status === 'racing' && result.text) {
          setRaceText(result.text);
          setPos(0);
          startTsRef.current = Date.now();
          setStarting(false);
        }
      } catch (err) {
        if (cancelled) return;

        console.error('[room] load error:', err);

        setError(
          err?.friendlyMessage ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to load room'
        );
      }
    }

    loadRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  /*
   * ---------------------------------------------------------
   * RESET JOIN STATE WHEN SOCKET DISCONNECTS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!connected) {
      joinedRoomRef.current = null;
    }
  }, [connected]);

  /*
   * ---------------------------------------------------------
   * LIVE RACE TIMER
   * Ticks only while a race is actually in progress, so it costs nothing
   * on every other screen/state.
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (room?.status !== 'racing') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [room?.status]);

  /*
   * ---------------------------------------------------------
   * SOCKET ROOM CONNECTION
   *
   * NOTE: the server pushes every room event (countdown, go, updates,
   * kicks, ...) to each participant's PERSONAL channel (user:<id>), which
   * every socket joins the instant it connects — not just to a room-
   * specific channel that depends on this room:join having already run.
   * That's what makes a second player see a started race without needing
   * to refresh. room:join below still matters for pulling a fresh
   * room:update/room:text snapshot on demand.
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!socket || !connected || !roomId) {
      return;
    }

    if (joinedRoomRef.current === roomId) {
      return;
    }

    joinedRoomRef.current = roomId;

    console.log(
      '[room] joining socket room:',
      roomId
    );

    socket.emit(
      SOCKET_EVENTS.joinRoom,
      {
        roomId,
      }
    );

    /*
     * ROOM UPDATE
     */

    const onRoomUpdate = (updatedRoom) => {
      console.log(
        '[socket] room:update',
        updatedRoom
      );

      setRoom(updatedRoom);

      const map = {};

      (updatedRoom.participants || []).forEach(
        (participant) => {
          map[String(participant.userId)] =
            participant;
        }
      );

      setPlayers(map);
    };

    /*
     * ROOM TEXT (recovery path)
     */

    const onRoomText = ({ text }) => {
      console.log(
        '[socket] room:text, length =',
        text?.length
      );

      setRaceText((previous) => {
        if (previous === (text || '')) {
          return previous;
        }

        setPos(0);
        setFinished(false);

        correctRef.current = 0;
        totalRef.current = 0;

        startTsRef.current = Date.now();

        return text || '';
      });
    };

    /*
     * COUNTDOWN
     */

    const onCountdown = ({ seconds }) => {
      console.log(
        `[room:countdown] ${roomId} → ${seconds}`
      );

      setStarting(true);

      setCountdown(seconds);

      playCountdownBeep();

      setRoom((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          status: 'countdown',
        };
      });
    };

    /*
     * RACE START
     */

    const onGo = ({
      text,
      startedAt,
      duration,
      mode,
    }) => {
      console.log(
        '[room:go] RACE STARTED',
        {
          roomId,
          textLength: text?.length,
          startedAt,
          duration,
          mode,
        }
      );

      setCountdown(null);
      setStarting(false);

      playGoBeep();

      setRoom((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          status: 'racing',
          startedAt,
          duration,
          mode,
        };
      });

      setRaceText(text || '');

      setPos(0);

      setFinished(false);

      correctRef.current = 0;
      totalRef.current = 0;

      startTsRef.current = Date.now();
      setNow(Date.now());
    };

    /*
     * PLAYER PROGRESS
     */

    const onRaceUpdate = (player) => {
      console.log(
        '[socket] race:update',
        player
      );

      setPlayers((previous) => ({
        ...previous,

        [String(player.userId)]: {
          ...previous[String(player.userId)],
          ...player,
        },
      }));
    };

    /*
     * PLAYER FINISHED
     */

    const onPlayerFinished = (player) => {
      console.log(
        '[socket] race:playerFinished',
        player
      );

      setPlayers((previous) => ({
        ...previous,

        [String(player.userId)]: {
          ...previous[String(player.userId)],
          ...player,
          finished: true,
        },
      }));

      if (
        String(player.userId) ===
        String(user?.id)
      ) {
        showToast(
          `You finished — rank #${player.rank}`
        );
      }
    };

    /*
     * ROOM ENDED
     */

    const onRoomEnded = (endedRoom) => {
      console.log(
        '[socket] room:ended',
        endedRoom
      );

      setRoom(endedRoom);

      setStarting(false);
      setCountdown(null);

      showToast('Race finished!');
    };

    /*
     * REACTION
     */

    const onReaction = ({
      username,
      emoji,
    }) => {
      showToast(
        `${username} ${emoji}`
      );
    };

    /*
     * SOCKET ERROR
     */

    const onRoomError = ({ message }) => {
      console.error(
        '[socket] room:error:',
        message
      );

      setStarting(false);
      setCountdown(null);

      showToast(message);
    };

    /*
     * KICKED — sent only to the removed player, on their own personal
     * channel. Anyone else in the room finds out via the normal
     * room:update (shrunk participant list).
     */

    const onKicked = ({ message }) => {
      showToast(message || 'You were removed from this room.');
      navigate('/tournaments');
    };

    /*
     * REGISTER EVENTS
     */

    socket.on(
      SOCKET_EVENTS.roomUpdate,
      onRoomUpdate
    );

    socket.on(
      SOCKET_EVENTS.roomText,
      onRoomText
    );

    socket.on(
      SOCKET_EVENTS.countdown,
      onCountdown
    );

    socket.on(
      SOCKET_EVENTS.go,
      onGo
    );

    socket.on(
      SOCKET_EVENTS.raceUpdate,
      onRaceUpdate
    );

    socket.on(
      SOCKET_EVENTS.playerFinished,
      onPlayerFinished
    );

    socket.on(
      SOCKET_EVENTS.roomEnded,
      onRoomEnded
    );

    socket.on(
      SOCKET_EVENTS.reaction,
      onReaction
    );

    socket.on(
      SOCKET_EVENTS.roomError,
      onRoomError
    );

    socket.on(
      SOCKET_EVENTS.kicked,
      onKicked
    );

    /*
     * CLEANUP
     */

    return () => {
      socket.off(
        SOCKET_EVENTS.roomUpdate,
        onRoomUpdate
      );

      socket.off(
        SOCKET_EVENTS.roomText,
        onRoomText
      );

      socket.off(
        SOCKET_EVENTS.countdown,
        onCountdown
      );

      socket.off(
        SOCKET_EVENTS.go,
        onGo
      );

      socket.off(
        SOCKET_EVENTS.raceUpdate,
        onRaceUpdate
      );

      socket.off(
        SOCKET_EVENTS.playerFinished,
        onPlayerFinished
      );

      socket.off(
        SOCKET_EVENTS.roomEnded,
        onRoomEnded
      );

      socket.off(
        SOCKET_EVENTS.reaction,
        onReaction
      );

      socket.off(
        SOCKET_EVENTS.roomError,
        onRoomError
      );

      socket.off(
        SOCKET_EVENTS.kicked,
        onKicked
      );
    };
  }, [
    socket,
    connected,
    roomId,
    showToast,
    user?.id,
    navigate,
  ]);

  /*
   * ---------------------------------------------------------
   * IS OWNER?
   * ---------------------------------------------------------
   */

  const isOwner =
    !!room?.participants?.find(
      (participant) =>
        String(participant.userId) ===
        String(user?.id)
    )?.isOwner;

  /*
   * ---------------------------------------------------------
   * START RACE
   * ---------------------------------------------------------
   */

  const startRace = () => {
    if (!socket) {
      showToast(
        'Socket connection is not ready.'
      );

      return;
    }

    if (!connected) {
      showToast(
        'Connecting to the race server...'
      );

      return;
    }

    if (!roomId) {
      showToast(
        'Room ID is missing.'
      );

      return;
    }

    if (!isOwner) {
      showToast(
        'Only the room owner can start the race.'
      );

      return;
    }

    if (room?.status !== 'waiting') {
      return;
    }

    if (starting) {
      return;
    }

    console.log(
      '[startRace] START BUTTON CLICKED',
      {
        roomId,
        socketConnected: socket.connected,
        socketId: socket.id,
      }
    );

    setStarting(true);

    socket.emit(
      SOCKET_EVENTS.startRace,
      {
        roomId,
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * KICK PLAYER (owner only)
   * ---------------------------------------------------------
   */

  const kickPlayer = (targetUserId, targetUsername) => {
    if (!socket || !connected || !isOwner) return;
    if (!confirm(`Remove ${targetUsername} from this room?`)) return;

    socket.emit(SOCKET_EVENTS.kickPlayer, { roomId, targetUserId });
  };

  /*
   * ---------------------------------------------------------
   * REPORT PROGRESS
   * ---------------------------------------------------------
   */

  const reportProgress = useCallback(
    (
      newPosition,
      correct,
      total
    ) => {
      if (!socket || !raceText) {
        return {
          wpm: 0,
          accuracy: 100,
        };
      }

      const elapsedMinutes =
        Math.max(
          (Date.now() -
            startTsRef.current) /
            60000,
          1 / 60
        );

      const wpm = Math.round(
        (correct / 5) /
          elapsedMinutes
      );

      const accuracy = total
        ? Math.round(
            (correct / total) * 100
          )
        : 100;

      const progress =
        raceText.length > 0
          ? Math.round(
              (newPosition /
                raceText.length) *
                100
            )
          : 0;

      socket.emit(
        SOCKET_EVENTS.raceProgressEmit,
        {
          roomId,
          progress,
          wpm,
          accuracy,
        }
      );

      return {
        wpm,
        accuracy,
      };
    },
    [
      socket,
      roomId,
      raceText,
    ]
  );

  /*
   * ---------------------------------------------------------
   * TYPING
   * ---------------------------------------------------------
   */

  const handleKeyDown = (event) => {
    if (!raceText) return;

    if (finished) return;

    if (room?.status !== 'racing') {
      return;
    }

    if (
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    const expected =
      raceText[pos];

    const correct =
      event.key === expected;

    playKeySound(correct);

    totalRef.current += 1;

    if (correct) {
      correctRef.current += 1;
    }

    /*
     * Wrong character does NOT move forward.
     */

    const newPosition =
      pos +
      (correct ? 1 : 0);

    setPos(newPosition);

    /*
     * FINISHED
     */

    if (
      newPosition >=
      raceText.length
    ) {
      setFinished(true);

      const {
        wpm,
        accuracy,
      } = reportProgress(
        newPosition,
        correctRef.current,
        totalRef.current
      );

      socket?.emit(
        SOCKET_EVENTS.raceFinishEmit,
        {
          roomId,
          wpm,
          accuracy,
          chars:
            totalRef.current,
        }
      );

      return;
    }

    /*
     * NORMAL PROGRESS
     */

    reportProgress(
      newPosition,
      correctRef.current,
      totalRef.current
    );
  };

  /*
   * ---------------------------------------------------------
   * LOADING / ERROR
   * ---------------------------------------------------------
   */

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic">
          ⚠
        </div>

        <p>{error}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="empty-state">
        <div className="ic">
          ⏳
        </div>

        <p>
          Loading room…
        </p>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * PLAYERS
   * ---------------------------------------------------------
   */

  const playerList =
    Object.values(players);

  /*
   * ---------------------------------------------------------
   * TIMER MATH
   * ---------------------------------------------------------
   */

  const elapsedSec = room.startedAt
    ? Math.max(0, Math.floor((now - new Date(room.startedAt).getTime()) / 1000))
    : 0;
  const remainingSec = room.mode === 'time' && room.duration
    ? Math.max(0, room.duration - elapsedSec)
    : null;
  const formatClock = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <>
      {/* ------------------------------------------------ */}
      {/* TOP COUNTDOWN BAR — fixed to the viewport top, visible on both
          the host's and every other player's screen since `countdown`
          arrives via the same personal-channel broadcast for everyone. */}
      {/* ------------------------------------------------ */}

      {countdown != null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'var(--border)',
            zIndex: 999,
          }}
        >
          <div
            key={countdown}
            style={{
              height: '100%',
              background: 'var(--accent)',
              width: '100%',
              animation: 'tfCountdownShrink 1s linear forwards',
            }}
          />
        </div>
      )}

      <div className="view-header">
        <h2>
          Room {roomId}
        </h2>

        <p>
          {connected
            ? 'Connected.'
            : 'Connecting…'}

          {' '}

          Status:{' '}

          <strong>
            {room.status}
          </strong>
        </p>
      </div>

      {/* ------------------------------------------------ */}
      {/* COUNTDOWN (big number, center of page) */}
      {/* ------------------------------------------------ */}

      {countdown != null && (
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              fontFamily:
                'var(--font-mono)',
            }}
          >
            {countdown}
          </div>

          <div
            style={{
              marginTop: 8,
              color:
                'var(--text-muted)',
            }}
          >
            Get ready...
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* START BUTTON */}
      {/* ------------------------------------------------ */}

      {room.status === 'waiting' &&
        isOwner && (
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <button
              className="btn btn-primary"
              onClick={startRace}
              disabled={
                starting ||
                !connected
              }
              style={{
                minWidth: 150,
              }}
            >
              {!connected
                ? 'Connecting...'
                : starting
                  ? countdown != null
                    ? `Starting ${countdown}...`
                    : 'Starting...'
                  : 'Start race'}
            </button>
          </div>
        )}

      {/* ------------------------------------------------ */}
      {/* LIVE TIMER */}
      {/* ------------------------------------------------ */}

      {room.status === 'racing' && (
        <div
          className="card"
          style={{
            padding: '10px 16px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <span className="modal-sub" style={{ fontFamily: 'inherit' }}>
            {remainingSec !== null ? 'Time remaining' : 'Elapsed'}
          </span>
          <strong style={{ fontSize: 20, color: remainingSec === 0 ? 'var(--danger)' : 'var(--text)' }}>
            {remainingSec !== null ? formatClock(remainingSec) : formatClock(elapsedSec)}
          </strong>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* TYPING AREA */}
      {/* ------------------------------------------------ */}

      {raceText &&
        room.status === 'racing' &&
        !finished && (
          <div
            className="test-stage"
            style={{
              marginBottom: 20,
            }}
          >
            <div
              className="text-display"
              tabIndex={0}
              autoFocus
              onKeyDown={handleKeyDown}
              style={{
                fontSize: 20,
                outline: 'none',
              }}
            >
              {raceText
                .split('')
                .map(
                  (
                    character,
                    index
                  ) => (
                    <span
                      key={index}
                      className={
                        'ch' +
                        (index < pos
                          ? ' correct'
                          : '') +
                        (index === pos
                          ? ' current'
                          : '')
                      }
                    >
                      {character}
                    </span>
                  )
                )}
            </div>
          </div>
        )}

      {/* ------------------------------------------------ */}
      {/* FINISHED */}
      {/* ------------------------------------------------ */}

      {finished && (
        <div
          className="form-error"
          style={{
            background:
              'var(--success-soft)',
            color:
              'var(--success)',
            marginBottom: 20,
          }}
        >
          You finished! Waiting for the others…
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* PLAYERS */}
      {/* ------------------------------------------------ */}

      <div
        className="card"
        style={{
          padding: 22,
        }}
      >
        <h4
          style={{
            marginBottom: 16,
          }}
        >
          Players
        </h4>

        {playerList.map(
          (player) => (
            <div
              key={player.userId}
              style={{
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  fontSize: 13.5,
                  marginBottom: 4,
                }}
              >
                <span>
                  {player.username}

                  {player.isOwner
                    ? ' 👑'
                    : ''}
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily:
                        'var(--font-mono)',
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    {player.wpm ?? 0}{' '}
                    wpm
                  </span>

                  {isOwner && !player.isOwner && room.status === 'waiting' && (
                    <button
                      type="button"
                      className="link-btn"
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                      onClick={() => kickPlayer(player.userId, player.username)}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </div>

              <div className="tourn-progress">
                <i
                  style={{
                    width: `${
                      player.progress ??
                      0
                    }%`,
                  }}
                />
              </div>
            </div>
          )
        )}

        {!playerList.length && (
          <p className="modal-sub">
            Waiting for players…
          </p>
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* BACK */}
      {/* ------------------------------------------------ */}

      <div
        style={{
          marginTop: 20,
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() =>
            navigate('/tournaments')
          }
        >
          Back to Tournaments
        </button>
      </div>
    </>
  );
}