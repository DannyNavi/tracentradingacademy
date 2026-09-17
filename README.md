# Tracen Trading Training

A multiplayer property-trading board game with Kahoot-style lobby codes.
Hosts can customize every property name and all Fuji's Hat / Stable Memo events.

## Run locally

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server (Socket.IO): http://localhost:3001

Open two browser windows, create a lobby in one, join with the code in the other.

## Production

```bash
npm run build
npm start
```

Serves the built client from Express on port 3001 (or `PORT`).

## Notes

- Turn-based rules keep global play comfortable over latency.
- Defaults are original horse-training themed names — replace them in the host config screen.
- Not affiliated with Hasbro, Kahoot, or Cygames.
