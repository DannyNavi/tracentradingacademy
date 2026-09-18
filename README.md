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

### Deploy on Render

1. Push this repo to GitHub.
2. In [Render](https://render.com), **New → Blueprint** and select the repo (uses `render.yaml`), or create a **Web Service** with:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Health check path:** `/health`
3. Open the `*.onrender.com` URL.

Free Render services sleep after ~15 minutes idle; the first request after sleep can take ~30–60s.

## Notes

- Persistent player IDs keep you in the lobby across page refresh.
- Default board names are fixed (no host rename editor).
- Turn-based play stays comfortable over normal internet latency.
