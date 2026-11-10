import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { RoomManager } from './game.js';
import { defaultContent } from './defaultContent.js';
import type { GameContent } from './types.js';
import type { TradeProposal, TradeResponse } from '../shared/trades.js';
import { refreshTrades } from './trading.js';
import type { PropertyAction } from '../shared/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/api/default-content', (_req, res) => {
  res.json(defaultContent());
});

const rooms = new RoomManager();

function publicRoom(room: ReturnType<RoomManager['createRoom']>) { return { ...room, cardDecks: undefined }; }

function emitRoom(code: string) {
  const room = rooms.rooms.get(code);
  if (!room) return;
  refreshTrades(room);
  io.to(code).emit('room:state', publicRoom(room));
}

function requirePlayerId(playerId: unknown): string {
  if (typeof playerId !== 'string' || !playerId.trim()) {
    throw new Error('Missing player id');
  }
  return playerId.trim().slice(0, 64);
}

function lobbyPlayerRoom(code: string, playerId: string) {
  return `lobby:${code}:${playerId}`;
}

function notifyLobbyDeparture(code: string, playerId: string, reason: 'kicked' | 'left') {
  const playerRoom = lobbyPlayerRoom(code, playerId);
  const sockets = io.in(playerRoom);
  sockets.emit('lobby:removed', { code, reason });
  sockets.socketsLeave([code, playerRoom]);
}

io.on('connection', (socket) => {
  socket.on(
    'lobby:create',
    ({ name, playerId }: { name: string; playerId: string }, ack?: (r: unknown) => void) => {
      try {
        const id = requirePlayerId(playerId);
        const room = rooms.createRoom(id, socket.id, name || 'Host');
        socket.join([room.code, lobbyPlayerRoom(room.code, id)]);
        ack?.({ ok: true, room: publicRoom(room), playerId: id });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on(
    'lobby:join',
    (
      { code, name, playerId }: { code: string; name: string; playerId: string },
      ack?: (r: unknown) => void,
    ) => {
      try {
        const id = requirePlayerId(playerId);
        const room = rooms.joinRoom(code, id, socket.id, name || 'Trainer');
        socket.join([room.code, lobbyPlayerRoom(room.code, id)]);
        ack?.({ ok: true, room: publicRoom(room), playerId: id });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on(
    'lobby:rejoin',
    (
      { code, playerId }: { code: string; playerId: string },
      ack?: (r: unknown) => void,
    ) => {
      try {
        const id = requirePlayerId(playerId);
        const room = rooms.rejoinRoom(code, id, socket.id);
        socket.join([room.code, lobbyPlayerRoom(room.code, id)]);
        ack?.({ ok: true, room: publicRoom(room), playerId: id });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('content:update', (content: GameContent, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.updateContent(socket.id, content);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('lobby:kick', (input: { playerId: string }, ack?: (r: unknown) => void) => {
    try {
      const playerId = requirePlayerId(input?.playerId);
      const room = rooms.kickLobbyPlayer(socket.id, playerId);
      notifyLobbyDeparture(room.code, playerId, 'kicked');
      ack?.({ ok: true });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('lobby:leave', (ack?: (r: unknown) => void) => {
    try {
      const { room, playerId } = rooms.leaveLobby(socket.id);
      notifyLobbyDeparture(room.code, playerId, 'left');
      ack?.({ ok: true });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('lobby:open', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.openLobby(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
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
        ack?.({ ok: true, room: publicRoom(room) });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('game:start', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.startGame(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:startingRoll', (input: { round: number }, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.rollStartingDice(socket.id, input?.round);
      ack?.({ ok: true, room: publicRoom(room) }); emitRoom(room.code);
    } catch (e) { ack?.({ ok: false, error: (e as Error).message }); }
  });

  socket.on('game:roll', (
    input?: { chosenDie: number } | ((r: unknown) => void),
    response?: (r: unknown) => void,
  ) => {
    const ack = typeof input === 'function' ? input : response;
    try {
      const room = rooms.rollDice(socket.id, typeof input === 'function' ? undefined : input?.chosenDie);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:buy', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.buy(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:pass', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.pass(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:pay', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.acknowledgePay(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('game:card', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.acknowledgeCard(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
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
        ack?.({ ok: true, room: publicRoom(room) });
        emitRoom(room.code);
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    },
  );

  socket.on('game:endTurn', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.endTurnManual(socket.id);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('trade:propose', (input: TradeProposal, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.proposeTrade(socket.id, input);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('trade:respond', (input: TradeResponse, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.respondToTrade(socket.id, input);
      ack?.({ ok: true, room: publicRoom(room) });
      emitRoom(room.code);
    } catch (e) {
      ack?.({ ok: false, error: (e as Error).message });
    }
  });

  socket.on('property:manage', (input: { spaceId: number; action: PropertyAction }, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.propertyAction(socket.id, input?.spaceId, input?.action);
      ack?.({ ok: true, room: publicRoom(room) }); emitRoom(room.code);
    } catch (e) { ack?.({ ok: false, error: (e as Error).message }); }
  });
  socket.on('auction:respond', (input: { auctionId: string; amount: number | null; targetId?: number }, ack?: (r: unknown) => void) => {
    try {
      const room = rooms.auctionAction(socket.id, input?.auctionId, input?.amount, input?.targetId);
      ack?.({ ok: true, room: publicRoom(room) }); emitRoom(room.code);
    } catch (e) { ack?.({ ok: false, error: (e as Error).message }); }
  });
  socket.on('debt:resolve', (input: { debtId: string; bankrupt: boolean }, ack?: (r: unknown) => void) => {
    try {
      if (typeof input?.bankrupt !== 'boolean') throw new Error('Choose payment or bankruptcy.');
      const room = rooms.debtAction(socket.id, input.debtId, input.bankrupt);
      ack?.({ ok: true, room: publicRoom(room) }); emitRoom(room.code);
    } catch (e) { ack?.({ ok: false, error: (e as Error).message }); }
  });
  socket.on('game:declareBankruptcy', (ack?: (r: unknown) => void) => {
    try {
      const room = rooms.declareBankruptcy(socket.id);
      ack?.({ ok: true, room: publicRoom(room) }); emitRoom(room.code);
    } catch (e) { ack?.({ ok: false, error: (e as Error).message }); }
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
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Tracen Trading Academy server on http://0.0.0.0:${PORT}`);
});
