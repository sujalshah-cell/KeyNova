# KeyNova — deploy notes

1. Copy your existing `Backend/.env` back in (it is NOT included), or set the same variables on your host.
   Template: `Backend/.env.example`. New variable to check: `FRONTEND_URL` (your public site URL).
2. The frontend is already built into `Backend/public/`, so you can deploy the Backend folder alone:
   `cd Backend && npm install && npm start`
3. To rebuild after frontend changes: `cd Frontend && npm install && npm run build` (outputs to Backend/public).
4. Google login: add `https://YOUR-DOMAIN/api/auth/google/callback` as an Authorized redirect URI and set
   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL.
5. Rotate the secrets from the original .env (it was inside the archive you shared).
