import { io, Socket } from 'socket.io-client';
import { getPlayerId } from './session';
import type { RoomState } from './types';
import type { TradeProposal, TradeResponse } from '../../shared/trades';
import type { PropertyAction } from '../../shared/rules';

type Ack = { ok: boolean; room?: RoomState; playerId?: string; error?: string };

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
  return emit('lobby:create', { name, playerId: getPlayerId() });
}

export async function joinLobby(code: string, name: string) {
  return emit('lobby:join', { code, name, playerId: getPlayerId() });
}

export async function rejoinLobby(code: string, playerId: string) {
  return emit('lobby:rejoin', { code, playerId });
}

export async function selectCharacter(characterId: string) {
  return emit('lobby:selectCharacter', { characterId });
}

export async function startGame() {
  return emit('game:start');
}

export const rollStartingDice = (round: number) => emit('game:startingRoll', { round });

export async function rollDice(chosenDie?: number) {
  return emit('game:roll', chosenDie === undefined ? undefined : { chosenDie });
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

export function proposeTrade(input: TradeProposal) {
  return emit('trade:propose', input);
}

export function respondToTrade(input: TradeResponse) {
  return emit('trade:respond', input);
}

export const manageProperty = (spaceId: number, action: PropertyAction) => emit('property:manage', { spaceId, action });
export const respondToAuction = (auctionId: string, amount: number | null, targetId?: number) => emit('auction:respond', { auctionId, amount, targetId });
export const resolveDebt = (debtId: string, bankrupt = false) => emit('debt:resolve', { debtId, bankrupt });
export const declareBankruptcy = () => emit('game:declareBankruptcy');
