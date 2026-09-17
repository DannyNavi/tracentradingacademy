import { defaultContent } from './defaultContent.js';
import type {
  BoardSpace,
  GameCard,
  GameContent,
  PendingAction,
  PlayerPublic,
  RoomState,
} from './types.js';

const PLAYER_COLORS = ['#E4572E', '#2E86AB', '#F2C14E', '#1B998B', '#A23B72', '#3D348B'];
const STARTING_MONEY = 1500;
const GO_BONUS = 200;
const JAIL_FINE = 50;
/** Keep lobbies alive briefly so a refresh can rejoin. */
const DISCONNECT_GRACE_MS = 120_000;

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function pushLog(room: RoomState, msg: string) {
  room.log = [msg, ...room.log].slice(0, 40);
}

function activePlayers(room: RoomState) {
  return room.players.filter((p) => !p.bankrupt);
}

function currentPlayer(room: RoomState): PlayerPublic {
  return room.players[room.turnIndex];
}

function spaceAt(room: RoomState, id: number): BoardSpace {
  return room.content.properties.find((s) => s.id === id)!;
}

function ownsGroup(room: RoomState, playerId: string, group: string): boolean {
  const groupSpaces = room.content.properties.filter((s) => s.group === group);
  return groupSpaces.every((s) => room.ownership[s.id] === playerId);
}

function railRent(room: RoomState, ownerId: string): number {
  const owned = room.content.properties.filter(
    (s) => s.kind === 'rail' && room.ownership[s.id] === ownerId,
  ).length;
  return [0, 25, 50, 100, 200][owned] ?? 200;
}

function utilityRent(room: RoomState, ownerId: string, diceTotal: number): number {
  const owned = room.content.properties.filter(
    (s) => s.kind === 'utility' && room.ownership[s.id] === ownerId,
  ).length;
  return diceTotal * (owned >= 2 ? 10 : 4);
}

function nextAliveIndex(room: RoomState, from: number): number {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (!room.players[idx].bankrupt) return idx;
  }
  return from;
}

function checkWinner(room: RoomState) {
  const alive = activePlayers(room);
  if (alive.length === 1) {
    room.phase = 'finished';
    room.winnerId = alive[0].id;
    room.canRoll = false;
    room.pending = { type: 'none' };
    pushLog(room, `${alive[0].name} wins the training circuit!`);
  }
}

function tryBankrupt(room: RoomState, player: PlayerPublic) {
  if (player.money >= 0) return;
  player.bankrupt = true;
  player.money = 0;
  for (const [spaceId, ownerId] of Object.entries(room.ownership)) {
    if (ownerId === player.id) delete room.ownership[Number(spaceId)];
  }
  pushLog(room, `${player.name} is eliminated.`);
  checkWinner(room);
}

function collectGo(room: RoomState, player: PlayerPublic, from: number, to: number, forced = false) {
  if (forced || to < from) {
    player.money += GO_BONUS;
    pushLog(room, `${player.name} passes Starting Gate (+${GO_BONUS} carats).`);
  }
}

function movePlayer(room: RoomState, player: PlayerPublic, to: number, grantGo = true) {
  const from = player.position;
  player.position = ((to % 40) + 40) % 40;
  if (grantGo) collectGo(room, player, from, player.position);
}

function moveRelative(room: RoomState, player: PlayerPublic, steps: number) {
  const from = player.position;
  const to = from + steps;
  player.position = ((to % 40) + 40) % 40;
  if (steps > 0) collectGo(room, player, from, player.position);
}

function sendToJail(room: RoomState, player: PlayerPublic) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  room.doublesCount = 0;
  room.canRoll = false;
  room.pending = { type: 'none' };
  pushLog(room, `${player.name} is sent to the Infirmary.`);
}

function applyCardEffect(room: RoomState, player: PlayerPublic, card: GameCard) {
  const effect = card.effect;
  switch (effect.type) {
    case 'money':
      player.money += effect.amount;
      pushLog(
        room,
        `${player.name}: ${card.text} (${effect.amount >= 0 ? '+' : ''}${effect.amount} carats)`,
      );
      tryBankrupt(room, player);
      room.pending = { type: 'none' };
      room.canRoll = false;
      break;
    case 'move':
      pushLog(room, `${player.name}: ${card.text}`);
      movePlayer(room, player, effect.position, true);
      room.pending = { type: 'none' };
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0);
      break;
    case 'move_relative':
      pushLog(room, `${player.name}: ${card.text}`);
      moveRelative(room, player, effect.steps);
      room.pending = { type: 'none' };
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0);
      break;
    case 'jail':
      pushLog(room, `${player.name}: ${card.text}`);
      sendToJail(room, player);
      break;
    case 'nearest_rail': {
      pushLog(room, `${player.name}: ${card.text}`);
      const rails = [5, 15, 25, 35];
      const next = rails.find((r) => r > player.position) ?? rails[0];
      movePlayer(room, player, next, true);
      room.pending = { type: 'none' };
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0);
      break;
    }
    case 'get_out_of_jail':
      player.getOutCards += 1;
      pushLog(room, `${player.name}: ${card.text}`);
      room.pending = { type: 'none' };
      room.canRoll = false;
      break;
  }
}

function drawCard(room: RoomState, deck: 'chance' | 'community'): GameCard {
  const cards = room.content[deck];
  const card = cards[Math.floor(Math.random() * cards.length)];
  return card;
}

function resolveLanding(room: RoomState, player: PlayerPublic, diceTotal: number) {
  if (room.phase === 'finished') return;
  const space = spaceAt(room, player.position);

  switch (space.kind) {
    case 'go':
    case 'free':
    case 'jail':
      room.pending = { type: 'none' };
      room.canRoll = false;
      break;
    case 'gotojail':
      sendToJail(room, player);
      break;
    case 'tax': {
      const amount = space.taxAmount ?? 100;
      room.pending = { type: 'pay_tax', amount };
      room.canRoll = false;
      break;
    }
    case 'chance':
    case 'community': {
      const deck = space.kind === 'chance' ? 'chance' : 'community';
      const card = drawCard(room, deck);
      room.pending = { type: 'card', deck, card };
      room.canRoll = false;
      break;
    }
    case 'property':
    case 'rail':
    case 'utility': {
      const ownerId = room.ownership[space.id];
      if (!ownerId) {
        room.pending = {
          type: 'buy_or_pass',
          spaceId: space.id,
          price: space.price ?? 0,
        };
        room.canRoll = false;
      } else if (ownerId !== player.id) {
        const owner = room.players.find((p) => p.id === ownerId)!;
        let amount = space.rent ?? 0;
        if (space.kind === 'rail') amount = railRent(room, ownerId);
        else if (space.kind === 'utility') amount = utilityRent(room, ownerId, diceTotal);
        else if (space.group && ownsGroup(room, ownerId, space.group)) amount *= 2;
        room.pending = { type: 'pay_rent', toPlayerId: owner.id, amount, spaceId: space.id };
        room.canRoll = false;
      } else {
        room.pending = { type: 'none' };
        room.canRoll = false;
      }
      break;
    }
  }
}

type SocketBinding = { roomCode: string; playerId: string };

export class RoomManager {
  rooms = new Map<string, RoomState>();
  /** Live socket → room + persistent player id */
  socketBindings = new Map<string, SocketBinding>();
  private roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private hostTransferTimers = new Map<string, ReturnType<typeof setTimeout>>();

  createRoom(playerId: string, socketId: string, hostName: string): RoomState {
    this.leaveCurrentRoom(socketId);

    let roomCode = code();
    while (this.rooms.has(roomCode)) roomCode = code();

    const host: PlayerPublic = {
      id: playerId,
      name: hostName.slice(0, 16) || 'Host',
      color: PLAYER_COLORS[0],
      characterId: null,
      money: STARTING_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutCards: 0,
      bankrupt: false,
      connected: true,
    };

    const room: RoomState = {
      code: roomCode,
      hostId: playerId,
      phase: 'config',
      content: defaultContent(),
      players: [host],
      turnIndex: 0,
      ownership: {},
      lastDice: null,
      doublesCount: 0,
      log: [`${host.name} opened lobby ${roomCode}.`],
      pending: { type: 'none' },
      winnerId: null,
      canRoll: false,
    };

    this.rooms.set(roomCode, room);
    this.bindSocket(socketId, roomCode, playerId);
    return room;
  }

  joinRoom(codeIn: string, playerId: string, socketId: string, name: string): RoomState {
    const room = this.rooms.get(codeIn.toUpperCase());
    if (!room) throw new Error('Lobby not found');

    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      return this.rejoinRoom(room.code, playerId, socketId);
    }

    if (room.phase === 'playing' || room.phase === 'finished') {
      throw new Error('Game already started');
    }
    if (room.players.length >= 6) throw new Error('Lobby is full');

    this.leaveCurrentRoom(socketId);

    const player: PlayerPublic = {
      id: playerId,
      name: name.slice(0, 16) || `Trainer ${room.players.length + 1}`,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
      characterId: null,
      money: STARTING_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutCards: 0,
      bankrupt: false,
      connected: true,
    };
    room.players.push(player);
    this.bindSocket(socketId, room.code, playerId);
    this.clearRoomCleanup(room.code);
    pushLog(room, `${player.name} joined.`);
    return room;
  }

  rejoinRoom(codeIn: string, playerId: string, socketId: string): RoomState {
    const room = this.rooms.get(codeIn.toUpperCase());
    if (!room) throw new Error('Lobby not found');
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Session expired — join again');

    this.leaveCurrentRoom(socketId);
    // Drop any stale socket still bound to this player
    for (const [sid, binding] of this.socketBindings) {
      if (binding.playerId === playerId && sid !== socketId) {
        this.socketBindings.delete(sid);
      }
    }

    const wasDisconnected = !player.connected;
    player.connected = true;
    this.bindSocket(socketId, room.code, playerId);
    this.clearRoomCleanup(room.code);
    this.clearHostTransfer(room.code);
    if (wasDisconnected) {
      pushLog(room, `${player.name} reconnected.`);
    }
    return room;
  }

  getRoomForSocket(socketId: string): RoomState | undefined {
    const binding = this.socketBindings.get(socketId);
    return binding ? this.rooms.get(binding.roomCode) : undefined;
  }

  getPlayerIdForSocket(socketId: string): string | undefined {
    return this.socketBindings.get(socketId)?.playerId;
  }

  updateContent(socketId: string, content: GameContent): RoomState {
    const room = this.requireHost(socketId);
    if (room.phase !== 'config' && room.phase !== 'lobby') {
      throw new Error('Can only edit content before the race starts');
    }
    if (!content.properties?.length || content.properties.length !== 40) {
      throw new Error('Board must have 40 spaces');
    }
    room.content = content;
    room.phase = 'lobby';
    pushLog(room, 'Board content updated by host.');
    return room;
  }

  openLobby(socketId: string): RoomState {
    const room = this.requireHost(socketId);
    if (room.phase !== 'config' && room.phase !== 'lobby') {
      throw new Error('Game already started');
    }
    room.phase = 'lobby';
    pushLog(room, 'Lobby is open.');
    return room;
  }

  selectCharacter(socketId: string, characterId: string): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    if (room.phase !== 'lobby' && room.phase !== 'config') {
      throw new Error('Character select is only available before the race');
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');
    const id = characterId.trim();
    if (!id) throw new Error('Pick a character');
    const taken = room.players.find((p) => p.id !== playerId && p.characterId === id);
    if (taken) throw new Error(`${taken.name} already chose that character`);
    player.characterId = id;
    pushLog(room, `${player.name} selected a trainee.`);
    return room;
  }

  startGame(socketId: string): RoomState {
    const room = this.requireHost(socketId);
    if (room.players.length < 2) throw new Error('Need at least 2 players');
    if (room.players.some((p) => !p.characterId)) {
      throw new Error('Every trainer must pick a character first');
    }
    room.phase = 'playing';
    room.turnIndex = 0;
    room.ownership = {};
    room.lastDice = null;
    room.doublesCount = 0;
    room.winnerId = null;
    room.pending = { type: 'none' };
    room.canRoll = true;
    for (const p of room.players) {
      p.money = STARTING_MONEY;
      p.position = 0;
      p.inJail = false;
      p.jailTurns = 0;
      p.getOutCards = 0;
      p.bankrupt = false;
    }
    pushLog(room, 'Race meeting started!');
    return room;
  }

  rollDice(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    if (!room.canRoll || room.pending.type !== 'none') throw new Error('Cannot roll now');
    const player = currentPlayer(room);

    if (player.inJail) {
      room.pending = { type: 'jail_choice' };
      room.canRoll = false;
      return room;
    }

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    room.lastDice = [d1, d2];
    const total = d1 + d2;
    const doubles = d1 === d2;

    if (doubles) room.doublesCount += 1;
    else room.doublesCount = 0;

    if (room.doublesCount >= 3) {
      pushLog(room, `${player.name} rolled triples doubles — Infirmary!`);
      sendToJail(room, player);
      return room;
    }

    pushLog(room, `${player.name} rolled ${d1}+${d2}=${total}${doubles ? ' (doubles)' : ''}.`);
    moveRelative(room, player, total);
    resolveLanding(room, player, total);

    if (room.pending.type === 'none' && doubles && !player.inJail && room.phase === 'playing') {
      room.canRoll = true;
    } else if (room.pending.type === 'none') {
      room.canRoll = false;
    }
    return room;
  }

  buy(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    if (room.pending.type !== 'buy_or_pass') throw new Error('Nothing to buy');
    const player = currentPlayer(room);
    const { spaceId, price } = room.pending;
    if (player.money < price) throw new Error('Not enough funds');
    player.money -= price;
    room.ownership[spaceId] = player.id;
    const space = spaceAt(room, spaceId);
    pushLog(room, `${player.name} acquired ${space.name} for ${price} carats.`);
    room.pending = { type: 'none' };
    this.afterAction(room);
    return room;
  }

  pass(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    if (room.pending.type !== 'buy_or_pass') throw new Error('Nothing to pass');
    const player = currentPlayer(room);
    const space = spaceAt(room, room.pending.spaceId);
    pushLog(room, `${player.name} passed on ${space.name}.`);
    room.pending = { type: 'none' };
    this.afterAction(room);
    return room;
  }

  acknowledgePay(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    const player = currentPlayer(room);
    if (room.pending.type === 'pay_rent') {
      const { toPlayerId, amount, spaceId } = room.pending;
      const owner = room.players.find((p) => p.id === toPlayerId)!;
      player.money -= amount;
      owner.money += amount;
      const space = spaceAt(room, spaceId);
      pushLog(room, `${player.name} paid ${amount} carats rent to ${owner.name} at ${space.name}.`);
      tryBankrupt(room, player);
      room.pending = { type: 'none' };
      this.afterAction(room);
      return room;
    }
    if (room.pending.type === 'pay_tax') {
      const { amount } = room.pending;
      player.money -= amount;
      pushLog(room, `${player.name} paid ${amount} carats in fees.`);
      tryBankrupt(room, player);
      room.pending = { type: 'none' };
      this.afterAction(room);
      return room;
    }
    throw new Error('No payment pending');
  }

  acknowledgeCard(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    if (room.pending.type !== 'card') throw new Error('No card pending');
    const player = currentPlayer(room);
    const { card } = room.pending;
    applyCardEffect(room, player, card);
    if (room.pending.type === 'none' && room.phase === 'playing' && !player.inJail) {
      this.afterAction(room);
    }
    return room;
  }

  jailAction(socketId: string, action: 'pay' | 'card' | 'roll'): RoomState {
    const room = this.requireTurn(socketId);
    const player = currentPlayer(room);
    if (!player.inJail) throw new Error('Not in Infirmary');

    if (room.pending.type === 'none' && room.canRoll) {
      room.pending = { type: 'jail_choice' };
      room.canRoll = false;
    }
    if (room.pending.type !== 'jail_choice') throw new Error('No jail choice');

    if (action === 'pay') {
      player.money -= JAIL_FINE;
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(room, `${player.name} paid ${JAIL_FINE} carats to leave Infirmary.`);
      tryBankrupt(room, player);
      room.pending = { type: 'none' };
      room.canRoll = true;
      return room;
    }

    if (action === 'card') {
      if (player.getOutCards < 1) throw new Error('No free pass');
      player.getOutCards -= 1;
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(room, `${player.name} used a free Infirmary pass.`);
      room.pending = { type: 'none' };
      room.canRoll = true;
      return room;
    }

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    room.lastDice = [d1, d2];
    if (d1 === d2) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(room, `${player.name} rolled doubles (${d1}+${d2}) and leaves Infirmary!`);
      room.pending = { type: 'none' };
      moveRelative(room, player, d1 + d2);
      resolveLanding(room, player, d1 + d2);
      if (room.pending.type === 'none') this.afterAction(room);
      return room;
    }

    player.jailTurns += 1;
    pushLog(room, `${player.name} failed to roll doubles (${d1}+${d2}).`);
    if (player.jailTurns >= 3) {
      player.money -= JAIL_FINE;
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(room, `${player.name} must pay ${JAIL_FINE} carats after 3 turns.`);
      tryBankrupt(room, player);
      room.pending = { type: 'none' };
      moveRelative(room, player, d1 + d2);
      resolveLanding(room, player, d1 + d2);
      if (room.pending.type === 'none') this.afterAction(room);
      return room;
    }

    room.pending = { type: 'none' };
    room.canRoll = false;
    this.endTurn(room);
    return room;
  }

  endTurnManual(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    if (room.pending.type !== 'none') throw new Error('Resolve current action first');
    if (room.canRoll) throw new Error('Roll first');
    this.endTurn(room);
    return room;
  }

  disconnect(socketId: string): RoomState | undefined {
    const binding = this.socketBindings.get(socketId);
    if (!binding) return undefined;
    const room = this.rooms.get(binding.roomCode);
    this.socketBindings.delete(socketId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === binding.playerId);
    if (player) {
      player.connected = false;
      pushLog(room, `${player.name} disconnected.`);
    }

    if (room.players.every((p) => !p.connected)) {
      this.scheduleRoomCleanup(room.code);
    } else if (room.hostId === binding.playerId) {
      this.scheduleHostTransfer(room.code, binding.playerId);
    }

    return room;
  }

  private bindSocket(socketId: string, roomCode: string, playerId: string) {
    this.socketBindings.set(socketId, { roomCode, playerId });
  }

  private leaveCurrentRoom(socketId: string) {
    const binding = this.socketBindings.get(socketId);
    if (!binding) return;
    // Soft leave without full disconnect cleanup when switching lobbies
    const room = this.rooms.get(binding.roomCode);
    this.socketBindings.delete(socketId);
    if (!room) return;
    const player = room.players.find((p) => p.id === binding.playerId);
    if (player) player.connected = false;
    if (room.players.every((p) => !p.connected)) {
      this.scheduleRoomCleanup(room.code);
    }
  }

  private clearRoomCleanup(roomCode: string) {
    const t = this.roomCleanupTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.roomCleanupTimers.delete(roomCode);
    }
  }

  private scheduleRoomCleanup(roomCode: string) {
    this.clearRoomCleanup(roomCode);
    const timer = setTimeout(() => {
      this.roomCleanupTimers.delete(roomCode);
      const room = this.rooms.get(roomCode);
      if (room && room.players.every((p) => !p.connected)) {
        for (const [sid, binding] of this.socketBindings) {
          if (binding.roomCode === roomCode) this.socketBindings.delete(sid);
        }
        this.clearHostTransfer(roomCode);
        this.rooms.delete(roomCode);
      }
    }, DISCONNECT_GRACE_MS);
    this.roomCleanupTimers.set(roomCode, timer);
  }

  private clearHostTransfer(roomCode: string) {
    const t = this.hostTransferTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.hostTransferTimers.delete(roomCode);
    }
  }

  private scheduleHostTransfer(roomCode: string, expectedHostId: string) {
    this.clearHostTransfer(roomCode);
    const timer = setTimeout(() => {
      this.hostTransferTimers.delete(roomCode);
      const room = this.rooms.get(roomCode);
      if (!room) return;
      if (room.hostId !== expectedHostId) return;
      const host = room.players.find((p) => p.id === expectedHostId);
      if (host?.connected) return;
      const next = room.players.find((p) => p.connected && p.id !== expectedHostId);
      if (next) {
        room.hostId = next.id;
        pushLog(room, `${next.name} is now the host.`);
      }
    }, DISCONNECT_GRACE_MS);
    this.hostTransferTimers.set(roomCode, timer);
  }

  private afterAction(room: RoomState) {
    if (room.phase !== 'playing') return;
    const player = currentPlayer(room);
    const doubles = room.lastDice && room.lastDice[0] === room.lastDice[1];
    if (doubles && !player.inJail && !player.bankrupt) {
      room.canRoll = true;
    } else {
      room.canRoll = false;
    }
  }

  private endTurn(room: RoomState) {
    if (room.phase !== 'playing') return;
    room.doublesCount = 0;
    room.lastDice = null;
    room.turnIndex = nextAliveIndex(room, room.turnIndex);
    room.pending = { type: 'none' };
    const next = currentPlayer(room);
    room.canRoll = true;
    pushLog(room, `${next.name}'s turn.`);
  }

  private requirePlayer(socketId: string): { room: RoomState; playerId: string } {
    const binding = this.socketBindings.get(socketId);
    if (!binding) throw new Error('Not in a lobby');
    const room = this.rooms.get(binding.roomCode);
    if (!room) throw new Error('Not in a lobby');
    return { room, playerId: binding.playerId };
  }

  private requireHost(socketId: string): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    if (room.hostId !== playerId) throw new Error('Only the host can do that');
    return room;
  }

  private requireTurn(socketId: string): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    if (room.phase !== 'playing') throw new Error('Game not in progress');
    if (currentPlayer(room).id !== playerId) throw new Error('Not your turn');
    if (currentPlayer(room).bankrupt) throw new Error('You are out');
    return room;
  }
}

export type { PendingAction };
