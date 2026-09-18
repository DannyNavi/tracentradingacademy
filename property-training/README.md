# Tracen Trading Academy

Multiplayer property-trading board game with Kahoot-style lobby codes. Uma Musume–inspired theming (fan project — not affiliated with Cygames, Hasbro, or Kahoot).

## Play locally

```bash
npm install
npm run dev
```

- Client: http://localhost:5173  
- Server (Socket.IO): http://localhost:3001  

Open two browser windows: create a lobby in one, join with the code in the other.

## Production

```bash
npm install
npm run build
npm start
```

Serves the Vite build from Express on `PORT` (default `3001`). Health check: `GET /health`.

### Deploy on Railway (recommended — no cold starts)

Railway keeps the service running 24/7 by default (do **not** enable Serverless/App Sleeping). Hobby is about **$5/month**.

1. Go to [railway.com/new](https://railway.com/new) and sign in with GitHub.
2. **Deploy from GitHub repo** → select `DannyNavi/tracentradingacademy`.
3. Railway detects `railway.json` (build + start + `/health`).
4. Generate a public domain under **Settings → Networking**.
5. Open the `*.up.railway.app` URL.

### Deploy on Render (free, but cold starts)

Free Render web services sleep after ~15 minutes idle. Prefer Railway if you want instant joins.

Uses `render.yaml` Blueprint: build `npm install && npm run build`, start `npm start`, health `/health`.

## Notes

- Persistent player IDs keep you in the lobby across page refresh.
- Default board names are fixed (no host rename editor).
- Turn-based play stays comfortable over normal internet latency.
- In-memory lobbies reset if the process restarts (deploys, crashes).
