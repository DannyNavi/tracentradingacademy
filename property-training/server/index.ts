import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { RoomManager } from './game.js';
import type { GameContent } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const rooms = new RoomManager();

function emitRoom(code: string) {
  const room = rooms.rooms.get(code);
  if (!room) return;
  io.to(code).emit('room:state', room);
}

io.on('connection', (socket) => {
  socket.on('lobby:create', ({ name }: { name: string }, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.createRoom(socket.id, name || 'Host');
      socket.join(room.code);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on(
    'lobby:join',
    ({ code, name }: { code: string; name: string }, ack?: (r: unknown) => void) => {
      try {
        const room = rooms.joinRoom(code, socket.id, name || 'Trainer');
        socket.join(room.code);
        ack?.({ ok: true, room });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('content:update', (content: GameContent, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.updateContent(socket.id, content);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('lobby:open', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.openLobby(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on(
    'lobby:selectCharacter',
    ({ characterId }: { characterId: string }, ack?: (r: unknown) => void) => {
      try {
        const room = rooms.selectCharacter(socket.id, characterId);
        ack?.({ ok: true, room });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('game:start', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.startGame(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:roll', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.rollDice(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:buy', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.buy(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:pass', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.pass(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:pay', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.acknowledgePay(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:card', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.acknowledgeCard(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on(
    'game:jail',
    ({ action }: { action: 'pay' | 'card' | 'roll' }, ack?: (r: unknown) => void) => {
      try {
        const room = rooms.jailAction(socket.id, action);
        ack?.({ ok: true, room });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('game:endTurn', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.endTurnManual(socket.id);
      ack?.({ ok: true, room });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('disconnect', () => {
    const room = rooms.disconnect(socket.id);
    if (room) emitRoom(room.code);
  });
});

const dist = path.join(__dirname, '../dist');
app.use(express.static(dist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build the client first (npm run build), or use npm run dev.');
  });
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`Tracen Trading Academy server on http://localhost:${PORT}`);
});
