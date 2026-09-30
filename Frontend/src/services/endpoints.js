/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH FOR API PATHS
 * ============================================================================
 * Every path below is verified directly against the real Backend files:
 * routes/auth.js, routes/rooms.js, routes/stats.js, routes/notifications.js,
 * sockets/index.js. Nothing here is a guess anymore.
 * ============================================================================
 */

export const HEALTH = '/health'; // GET — defined directly in server.js

export const AUTH = {
  register: '/auth/register',           // POST { username, email, password } -> { token, user }
  login: '/auth/login',                 // POST { email, password } -> { token, user }
  me: '/auth/me',                       // GET  -> { user }
  updateSettings: '/auth/settings',     // PUT  { ...settings fields } -> { user }
  providers: '/auth/providers',         // GET  -> { google, github, sso }
  googleStart: '/auth/google',          // full-page redirect (not an XHR call)
  githubStart: '/auth/github',          // full-page redirect (not an XHR call)
  link: (provider) => `/auth/link/${provider}`, // POST -> { url } to connect | DELETE -> { user } to disconnect
  ssoInit: '/auth/sso/init'             // POST { domain } -> currently 501 until a workspace is configured
};

export const STATS = {
  submit: '/stats/result',   // POST a completed typing-test result -> { result, stats, streak }
  overview: '/stats'         // GET  -> { stats, streak, recent }  (recent = last 30 results)
};

export const ROOMS = {
  create: '/rooms',                          // POST { mode, duration, wordCount, customText, maxPlayers, password } -> { room, password }
  join: '/rooms/join',                       // POST { roomId, password } -> { room }
  get: (roomId) => `/rooms/${roomId}`        // GET -> { room }  (must already be a participant)
  // NOTE: the backend has no "leave room" endpoint yet — there is nothing
  // to call here. If you add one server-side (e.g. POST /rooms/:id/leave),
  // add it to this object and to roomService.js together.
};

export const NOTIFICATIONS = {
  list: '/notifications',                       // GET -> { items, unreadCount }
  markRead: (id) => `/notifications/${id}/read`, // POST -> { ok }
  markAllRead: '/notifications/read-all'         // POST -> { ok }
};

// Socket.IO event names — verified against Backend/sockets/index.js.
export const SOCKET_EVENTS = {
  joinRoom: 'room:join',           // emit { roomId }
  startRace: 'room:start',         // emit { roomId } — owner only
  kickPlayer: 'room:kick',         // emit { roomId, targetUserId } — owner only
  kicked: 'room:kicked',           // on   { roomId, message } — sent only to the removed player
  roomUpdate: 'room:update',       // on   (room)
  roomText: 'room:text',           // on   { text }
  countdown: 'room:countdown',     // on   { seconds }
  go: 'room:go',                   // on   { text, startedAt, duration, mode }
  raceProgressEmit: 'race:progress', // emit { roomId, progress, wpm, accuracy }
  raceUpdate: 'race:update',       // on   { userId, username, progress, wpm, accuracy }
  raceFinishEmit: 'race:finish',   // emit { roomId, wpm, accuracy, chars }
  playerFinished: 'race:playerFinished', // on { userId, username, wpm, accuracy, rank }
  roomEnded: 'room:ended',         // on   (room)
  reaction: 'room:reaction',       // emit/on { roomId, emoji } / { username, emoji }
  roomError: 'room:error',         // on   { message }
  notification: 'notification:new' // on   (notification)
};