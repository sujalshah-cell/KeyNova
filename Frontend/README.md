# KeyNova — Frontend (Vite + React)

Converted from the static `Frontend/app/{index.html,css,js}` build. Same cream/amber
design, same typing-test behavior, now wired to your Express + MongoDB backend
through a service layer instead of `localStorage`-only state.

## Run it

```bash
cd Frontend
npm install
npm run dev        # http://localhost:5173
```

In a second terminal:

```bash
cd Backend
npm install
npm run start       # http://localhost:5000 — "KeyNova server listening on port 5000"
```

The Vite dev server proxies `/api` and `/socket.io` to `localhost:5000` (see
`vite.config.js`), so the browser only ever talks to `:5173` — no CORS changes
needed on the backend for local development, and `Backend/.env`'s `CORS_ORIGIN`
can stay unset.

`npm run build` outputs straight into `../Backend/public`, matching what
`server.js` already serves (`express.static(public/)` + SPA fallback). That
means `npm run build` in Frontend/ followed by `npm start` in Backend/ is a
complete same-origin production deploy, with no separate frontend host and no
CORS surface at all — this was already your architecture, I just pointed the
build output at it.

⚠️ **Before you build**, back up whatever is currently in `Backend/public/` —
`emptyOutDir: true` means the Vite build **replaces** that folder's contents.

## What's confirmed vs. inferred

I could only read `server.js`, `package.json`, `.env`, `.gitignore`, and
`README.md` — `config/`, `middleware/`, `models/`, `routes/`, `sockets/`, and
`public/` all uploaded as empty (0-byte) files, so none of your actual route
handlers, Mongoose schemas, or Socket.IO events were readable.

Every API path lives in **one file**, `src/services/endpoints.js`, tagged:

- **CONFIRMED** — verified against `server.js` directly, or against the real
  Postman response you pasted (register returning `{ token, user: { stats,
  streak, settings } }`).
- **INFERRED** — the base router is confirmed mounted in `server.js`
  (`/api/auth`, `/api/rooms`, `/api/stats`, `/api/notifications`), but the
  exact sub-path/method is a REST-convention guess, not verified.

| Feature | Method | Endpoint | Status | Notes |
|---|---|---|---|---|
| Health check | GET | `/api/health` | ✅ Confirmed | Defined directly in `server.js` |
| Register | POST | `/api/auth/register` | ⚠️ Inferred path / ✅ confirmed response shape | Response shape matches your Postman test exactly |
| Login | POST | `/api/auth/login` | ⚠️ Inferred | Not yet verified at all |
| Current user | GET | `/api/auth/me` | ⚠️ Inferred | Used to restore session on page refresh |
| Update settings | PATCH | `/api/auth/settings` | ⚠️ Inferred | Only pushes `{theme, soundEnabled}` — the two fields your Postman response actually showed on `user.settings` |
| Submit result | POST | `/api/stats` | ⚠️ Inferred | `{ mode, wpm, accuracy, chars, consistency }` |
| History | GET | `/api/stats/history` | ⚠️ Inferred | |
| Leaderboard | GET | `/api/stats/leaderboard` | ⚠️ Inferred | Not used in UI yet — no page for it |
| Create room | POST | `/api/rooms` | ⚠️ Inferred | `{ mode, password, maxPlayers, customText }` |
| Join room | POST | `/api/rooms/:id/join` | ⚠️ Inferred | `{ password }` |
| Get room | GET | `/api/rooms/:id` | ⚠️ Inferred | |
| Leave room | POST | `/api/rooms/:id/leave` | ⚠️ Inferred | |
| Notifications list | GET | `/api/notifications` | ⚠️ Inferred | |
| Mark read | PATCH | `/api/notifications/:id/read` | ⚠️ Inferred | |
| Socket events | — | `room:join`, `room:update`, `room:countdown`, `race:progress`, `race:finished`, `notification:new` | ❌ Placeholder | `sockets/index.js` was empty — these names are guesses in `SOCKET_EVENTS` |

**To fix the ⚠️/❌ rows**: share the real contents of `routes/*.js`,
`models/*.js`, `middleware/*.js`, and `sockets/index.js` (zip the `Backend`
folder, or paste the files directly), and I'll update `endpoints.js` —
nothing else needs to change since every service imports paths from there.

## What works regardless of the guesses

Dashboard, Typing Test, Practice, and Settings' local prefs (font size, caret,
stop-on-error) are fully client-side and work today with zero backend
dependency — same as the original app. Auth, saved stats/history,
Tournaments (create/join room), the live Room race view, and Notifications
all call the inferred endpoints above and **fail gracefully**: a 404 shows a
friendly toast/error instead of crashing, because the exact path is still
unverified.

## Security note

Nothing in this frontend contains your Mongo URI, JWT secret, or any other
`Backend/.env` value — `VITE_API_BASE_URL` is the only environment variable
it reads, and it's just a URL path (`/api`).
