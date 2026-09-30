# KeyNova — Web Edition

A full-stack typing-speed web app converted from the original Electron/Steam desktop
build. Runs in any modern browser (Chrome, Edge, Firefox, Safari) on desktop, tablet
and mobile — no install required.

## What's included
- **Auth**: JWT-based register/login, bcrypt password hashing
- **Database**: MongoDB (Mongoose) — Users, Rooms, Notifications, TypingResults
- **Core typing game**: Dashboard, Typing Test (Time/Words/Quote/Code/Custom/Zen), Practice, Statistics
- **NEW — Tournaments**: Competition → Create Room / Join Room
  - Timed or custom-text races, room ID + password, max 10 players
  - Live synced 3-2-1 countdown, real-time progress bars & WPM for every player (Socket.IO)
  - Emoji reactions during the race, final leaderboard, rematch flow
  - Room owner gets a **notification** the instant someone joins (bell icon, in-app toast, persisted list)
- **NEW — Notifications** panel next to Settings
- SPA routing that survives a hard refresh (`/tournaments`, `/typing-test`, etc. all work directly)
- CORS driven entirely by an environment variable — zero hardcoded localhost URLs

## Project structure
```
server.js              Express + Socket.IO entrypoint
config/db.js           Mongo connection
models/                User, Room, Notification, TypingResult
routes/                 /api/auth, /api/rooms, /api/stats, /api/notifications
sockets/index.js       Real-time race + notification logic
public/                Frontend (plain HTML/CSS/JS, no build step)
```

## Run locally
```bash
npm install
cp .env.example .env      # fill in MONGODB_URI and JWT_SECRET
npm start                 # http://localhost:5000
```

## Deploy to the public internet (free tier, ~10 minutes)

**1. Database — MongoDB Atlas**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access → add a user/password. Network Access → allow `0.0.0.0/0` (or your host's IP).
3. Copy the connection string → this is your `MONGODB_URI`.

**2. App host — Render (or Railway / Fly.io / any Node host)**
1. Push this folder to a GitHub repo.
2. On https://render.com → New → Web Service → connect the repo.
3. Build command: `npm install`   ·   Start command: `npm start`
4. Add environment variables (Render → Environment):
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = a long random string (e.g. `openssl rand -hex 32`)
   - `JWT_EXPIRES_IN` = `7d`
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = leave blank (this server serves the frontend too — same-origin)
5. Deploy. Render gives you a public **HTTPS URL** automatically, e.g. `https://keynova.onrender.com`.

That's it — visit the URL in Chrome, register an account, and everything (typing tests,
tournaments, notifications) works exactly as it does locally, over HTTPS, for anyone
with the link.

### Optional: split frontend/backend onto different domains
If you'd rather host the `public/` folder separately (e.g. on Vercel/Netlify) and
keep only the API on Render:
1. Build the frontend with `VITE_API_BASE_URL=https://your-api.onrender.com` (see Frontend/.env.example).
2. On the API host, set `CORS_ORIGIN=https://your-frontend-domain.com`.
3. Socket.IO will automatically connect to the same API origin.

## Notes on the multiplayer room system
- Rooms are created with a 6-character ID, a host-chosen password, and a mode
  (Timed race or Custom text), capped at 10 participants.
- Sharing: the room owner gets a "Copy invite" button that copies room ID + password +
  link in one block — ready to paste into WhatsApp, Gmail, Slack, etc.
- Joining triggers a real-time + persisted notification for the room owner, so it's
  visible immediately if they're online, and later from the notification bell if not.
- Races are synced server-side (countdown → `startedAt` timestamp → same text for
  everyone), with live WPM/progress broadcast over Socket.IO so it feels like a real race.


## Social login (Google / GitHub)
Sign-in with Google/GitHub uses OAuth on the server; KeyNova never sees a provider password.
Set these in Render's Environment tab (or Backend/.env locally) — see `Backend/.env.example`:

| Variable | Value |
|---|---|
| `FRONTEND_URL` | Your site URL, e.g. `https://keynova.onrender.com` (no trailing slash) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials > OAuth client (Web) |
| `GOOGLE_CALLBACK_URL` | `https://YOUR-DOMAIN/api/auth/google/callback` (must also be added as an *Authorized redirect URI* in Google) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub > Settings > Developer settings > OAuth Apps |
| `GITHUB_CALLBACK_URL` | `https://YOUR-DOMAIN/api/auth/github/callback` |

A provider button only works when its variables are set. Accounts are linked by a **verified** email only.
