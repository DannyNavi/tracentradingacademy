import { io, Socket } from 'socket.io-client';
import type { GameContent, RoomState } from './types';

type Ack = { ok: boolean; room?: RoomState; error?: string };

/** In Vite dev, talk to the API server directly (avoids proxy ack issues). */
const URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : undefined);

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

function emit(event: string, payload?: unknown): Promise<Ack> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Server did not respond — is the game server running on :3001?'));
    }, 10000);

    const ack = (res: Ack) => {
      window.clearTimeout(timer);
      resolve(res ?? { ok: false, error: 'Empty response' });
    };

    if (payload === undefined) {
      socket.emit(event, ack);
    } else {
      socket.emit(event, payload, ack);
    }
  });
}

export async function createLobby(name: string) {
  return emit('lobby:create', { name });
}

export async function joinLobby(code: string, name: string) {
  return emit('lobby:join', { code, name });
}

export async function updateContent(content: GameContent) {
  return emit('content:update', content);
}

export async function openLobby() {
  return emit('lobby:open');
}

export async function selectCharacter(characterId: string) {
  return emit('lobby:selectCharacter', { characterId });
}

export async function startGame() {
  return emit('game:start');
}

export async function rollDice() {
  return emit('game:roll');
}

export async function buyProperty() {
  return emit('game:buy');
}

export async function passProperty() {
  return emit('game:pass');
}

export async function payDue() {
  return emit('game:pay');
}

export async function resolveCard() {
  return emit('game:card');
}

export async function jailAction(action: 'pay' | 'card' | 'roll') {
  return emit('game:jail', { action });
}

export async function endTurn() {
  return emit('game:endTurn');
}
