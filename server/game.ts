import { drawFromDeck, initializeDecks, movePasses, returnCard } from './cards.js';
import { auctionAction, charge, creditCarats, liquidatePlayer, manageProperty, settleDebt, startPropertyAuction } from './economy.js';
import { caratGain, liquidationValue, type PropertyAction } from '../shared/rules.js';
import { calculateRent } from '../src/lib/rent.js';
import { proposeTrade, respondToTrade } from './trading.js';
import type { TradeProposal, TradeResponse } from '../shared/trades.js';
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
const TURN_MODIFIERS = ['movementModifiers', 'caratBonuses'] as const;
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

function collectGo(room: RoomState, player: PlayerPublic, from: number, to: number, forced = false) {
  if (forced || to < from) {
    creditCarats(room, player, GO_BONUS);
    pushLog(room, `${player.name} collects race earnings (+${GO_BONUS} carats).`);
  }
}

function recordMovement(player: PlayerPublic, steps: number) {
  const path = Array.from({ length: Math.abs(steps) + 1 }, (_, i) =>
    ((player.position + i * Math.sign(steps)) % 40 + 40) % 40);
  const history = player.movements ?? [];
  player.movements = [...history, { id: (history.at(-1)?.id ?? 0) + 1, path }].slice(-8);
}

function movePlayer(room: RoomState, player: PlayerPublic, to: number, grantGo = true) {
  const from = player.position;
  recordMovement(player, ((to - from) % 40 + 40) % 40);
  player.position = ((to % 40) + 40) % 40;
  if (grantGo) collectGo(room, player, from, player.position);
}

function moveRelative(room: RoomState, player: PlayerPublic, steps: number) {
  const from = player.position;
  recordMovement(player, steps);
  const to = from + steps;
  player.position = ((to % 40) + 40) % 40;
  if (steps > 0) collectGo(room, player, from, player.position);
}

function resolveMovementRoll(room: RoomState, player: PlayerPublic, diceTotal: number) {
  const modifier = player.movementModifiers?.reduce((total, effect) =>
    total + (effect.startsNextTurn ? 0 : effect.amount), 0) ?? 0;
  const steps = Math.max(0, diceTotal + modifier);
  if (modifier) pushLog(room, `${player.name} moves ${steps} spaces after the movement modifier.`);
  if (!steps) return;
  moveRelative(room, player, steps);
  resolveLanding(room, player, diceTotal);
}

function sendToJail(room: RoomState, player: PlayerPublic) {
  recordMovement(player, (10 - player.position + 40) % 40);
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  room.doublesCount = 0;
  room.extraRollEligible = false;
  room.canRoll = false;
  room.pending = { type: 'none' };
  pushLog(room, `${player.name} is sent to the Infirmary.`);
}

function applyCardEffect(room: RoomState, player: PlayerPublic, card: GameCard, wager = 0) {
  const effect = card.effect;
  room.pending = { type: 'none' };
  pushLog(room, player.name + ': ' + card.text);
  if (card.d20Below !== undefined) {
    const roll = 1 + Math.floor(Math.random() * 20);
    const applies = roll < card.d20Below;
    room.lastD20Roll = { playerId: player.id, value: roll, penaltyApplies: applies };
    pushLog(room, `${player.name} rolled ${roll} on the d20. ${applies ? 'The penalty applies.' : 'No penalty.'}`);
    if (!applies) return;
  }
  switch (effect.type) {
    case 'sports_bet': {
      const roll = 1 + Math.floor(Math.random() * 20);
      const multiplier = roll <= 10 ? 0 : roll <= 18 ? 2 : 4;
      const basePayout = wager * multiplier;
      const payout = caratGain(player, basePayout);
      player.money -= wager;
      creditCarats(room, player, basePayout);
      room.lastD20Roll = { playerId: player.id, value: roll, penaltyApplies: multiplier === 0, wager, payout };
      pushLog(room, `${player.name} wagered ${wager} Carats and rolled ${roll} on the d20. Payout: ${payout} Carats.`);
      break;
    }
    case 'money':
      if (effect.amount >= 0) creditCarats(room, player, effect.amount);
      else charge(room, player, -effect.amount, null, card.text);
      break;
    case 'money_all':
      for (const recipient of activePlayers(room)) creditCarats(room, recipient, effect.amount);
      break;
    case 'carat_bonus':
      player.caratBonuses ??= [];
      player.caratBonuses.push({ amount: effect.percent, turns: effect.turns, startsNextTurn: true });
      break;
    case 'move':
      movePlayer(room, player, effect.position, true);
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0, effect.rentFree ? 0 : 1);
      break;
    case 'move_relative':
      moveRelative(room, player, effect.steps);
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0);
      break;
    case 'jail': sendToJail(room, player); break;
    case 'skip_turns':
      player.skippedTurns = (player.skippedTurns ?? 0) + effect.turns;
      break;
    case 'movement_modifier':
      player.movementModifiers ??= [];
      player.movementModifiers.push({ amount: effect.amount, turns: effect.turns, startsNextTurn: true });
      break;
    case 'choose_die':
      player.dieChoice = 'next_turn';
      break;
    case 'nearest_rail': {
      const next = [5, 15, 25, 35].find((id) => id > player.position) ?? 5;
      movePlayer(room, player, next, true);
      resolveLanding(room, player, room.lastDice ? room.lastDice[0] + room.lastDice[1] : 0, 2);
      break;
    }
    case 'nearest_utility': {
      const next = [12, 28].find((id) => id > player.position) ?? 12;
      movePlayer(room, player, next, true);
      let dice: [number, number] = room.lastDice ?? [0, 0];
      if (room.ownership[next] && room.ownership[next] !== player.id && !room.mortgaged?.[next]) {
        dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        room.lastDice = dice; room.lastRollId = (room.lastRollId ?? 0) + 1;
      }
      resolveLanding(room, player, dice[0] + dice[1], 1, true);
      break;
    }
    case 'get_out_of_jail': player.getOutCards += 1; break;
    case 'pay_each':
      for (const other of activePlayers(room).filter((p) => p.id !== player.id)) charge(room, player, effect.amount, other.id, card.text);
      break;
    case 'collect_each':
      for (const other of activePlayers(room).filter((p) => p.id !== player.id)) charge(room, other, effect.amount, player.id, card.text);
      break;
    case 'repairs': {
      let amount = 0;
      for (const [id, ownerId] of Object.entries(room.ownership)) {
        if (ownerId !== player.id) continue;
        const level = room.buildings?.[Number(id)] ?? 0;
        amount += level === 5 ? effect.hotel : level * effect.house;
      }
      charge(room, player, amount, null, card.text);
      break;
    }
  }
}

function drawCard(room: RoomState, deck: 'chance' | 'community'): GameCard {
  return drawFromDeck(room, deck);
}

function resolveLanding(room: RoomState, player: PlayerPublic, diceTotal: number, rentMultiplier = 1, utilityOverride = false) {
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
        const amount = room.mortgaged?.[space.id] ? 0 : utilityOverride && space.kind === 'utility' ? diceTotal * 10 : calculateRent(room, space, diceTotal) * rentMultiplier;
        if (!amount) { room.pending = { type: 'none' }; room.canRoll = false; break; }
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
  private kickedPlayers = new WeakMap<RoomState, Set<string>>();

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
      phase: 'lobby',
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
    if (this.kickedPlayers.get(room)?.has(playerId)) throw new Error('The host removed you from this lobby.');

    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      return this.rejoinRoom(room.code, playerId, socketId);
    }

    if (room.phase === 'starting' || room.phase === 'playing' || room.phase === 'finished') {
      throw new Error('Game already started');
    }
    if (room.players.length >= 6) throw new Error('Lobby is full');

    this.leaveCurrentRoom(socketId);

    const player: PlayerPublic = {
      id: playerId,
      name: name.slice(0, 16) || `Trainer ${room.players.length + 1}`,
      color: PLAYER_COLORS.find((color) => room.players.every((p) => p.color !== color))!,
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
    if (this.kickedPlayers.get(room)?.has(playerId)) throw new Error('The host removed you from this lobby.');
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

  kickLobbyPlayer(socketId: string, playerId: string): RoomState {
    const { room, playerId: hostId } = this.requireLobby(socketId);
    if (room.hostId !== hostId) throw new Error('Only the host can remove players.');
    if (playerId === hostId) throw new Error('Use Leave lobby to leave your own lobby.');
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('That player is no longer in the lobby.');

    const kicked = this.kickedPlayers.get(room) ?? new Set<string>();
    kicked.add(playerId);
    this.kickedPlayers.set(room, kicked);
    this.removeLobbyPlayer(room, playerId);
    pushLog(room, `${player.name} was removed by the host.`);
    return room;
  }

  leaveLobby(socketId: string): { room: RoomState; playerId: string } {
    const { room, playerId } = this.requireLobby(socketId);
    const player = room.players.find((p) => p.id === playerId)!;
    this.removeLobbyPlayer(room, playerId);
    pushLog(room, `${player.name} left the lobby.`);
    return { room, playerId };
  }

  leaveFinishedGame(socketId: string): { room: RoomState; playerId: string } {
    const { room, playerId } = this.requirePlayer(socketId);
    if (room.phase !== 'finished') throw new Error('Wait until the game has finished before leaving.');
    const player = room.players.find((p) => p.id === playerId)!;
    player.connected = false;
    for (const [sid, binding] of this.socketBindings) {
      if (binding.roomCode === room.code && binding.playerId === playerId) this.socketBindings.delete(sid);
    }
    pushLog(room, `${player.name} left the finished game.`);
    if (room.players.every((p) => !p.connected)) {
      this.clearHostTransfer(room.code);
      this.clearRoomCleanup(room.code);
      this.rooms.delete(room.code);
    }
    return { room, playerId };
  }

  forceEndGame(socketId: string): RoomState {
    const room = this.requireHost(socketId);
    if (room.phase !== 'starting' && room.phase !== 'playing') throw new Error('There is no active game to end.');
    if (room.pending.type === 'card') returnCard(room, room.pending.deck, room.pending.card.id);
    room.phase = 'finished';
    room.winnerId = null;
    room.canRoll = false;
    room.extraRollEligible = false;
    room.pending = { type: 'none' };
    room.auction = null;
    room.auctionQueue = [];
    room.debts = [];
    room.debtResume = undefined;
    room.auctionResumeCanRoll = undefined;
    room.startingRound = undefined;
    pushLog(room, 'The host ended the game early.');
    return room;
  }

  private removeLobbyPlayer(room: RoomState, playerId: string) {
    room.players = room.players.filter((p) => p.id !== playerId);
    for (const [sid, binding] of this.socketBindings) {
      if (binding.roomCode === room.code && binding.playerId === playerId) this.socketBindings.delete(sid);
    }
    if (!room.players.length) {
      this.clearHostTransfer(room.code);
      this.clearRoomCleanup(room.code);
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) {
      this.clearHostTransfer(room.code);
      const nextHost = room.players.find((p) => p.connected) ?? room.players[0];
      room.hostId = nextHost.id;
      pushLog(room, `${nextHost.name} is now the host.`);
    }
    if (room.players.every((p) => !p.connected)) this.scheduleRoomCleanup(room.code);
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
    if (room.phase !== 'lobby' && room.phase !== 'config') throw new Error('Game already started');
    room.phase = 'starting';
    room.buildings = {}; room.mortgaged = {}; room.debts = []; room.auction = null; room.auctionQueue = []; room.debtResume = undefined;
    room.extraRollEligible = false; room.heldCards = {}; room.auctionResumeCanRoll = undefined;
    initializeDecks(room);
    room.startRolls = [];
    room.startingRound = { number: 1, eligibleIds: room.players.map((p) => p.id), rolls: {} };
    room.turnIndex = 0;
    room.ownership = {};
    room.trades = [];
    room.lastDice = null;
    delete room.lastD20Roll;
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
    room.canRoll = false;
    pushLog(room, 'Each trainer must roll to decide who goes first.');
    return room;
  }

  rollStartingDice(socketId: string, roundNumber: number): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    const round = room.startingRound;
    if (room.phase !== 'starting' || !round) throw new Error('Starting rolls have already finished.');
    if (round.number !== roundNumber) throw new Error('This round has ended. Review the current starting round.');
    if (!round.eligibleIds.includes(playerId)) throw new Error('Only players tied for the highest roll can reroll.');
    if (round.rolls[playerId]) throw new Error('You have already rolled in this round.');
    const dice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    round.rolls[playerId] = dice;
    room.startRolls ??= [];
    room.startRolls.push({ playerId, dice, round: round.number });
    const player = room.players.find((p) => p.id === playerId)!;
    pushLog(room, player.name + ' rolled ' + dice.join('+') + '=' + (dice[0] + dice[1]) + ' for starting order (round ' + round.number + ').');
    if (round.eligibleIds.every((id) => round.rolls[id])) {
      const highest = Math.max(...round.eligibleIds.map((id) => round.rolls[id][0] + round.rolls[id][1]));
      const leaders = round.eligibleIds.filter((id) => round.rolls[id][0] + round.rolls[id][1] === highest);
      if (leaders.length > 1) {
        room.startingRound = { number: round.number + 1, eligibleIds: leaders, rolls: {} };
        pushLog(room, 'Tie at ' + highest + '! ' + leaders.map((id) => room.players.find((p) => p.id === id)!.name).join(' and ') + ' must reroll.');
      } else {
        room.turnIndex = room.players.findIndex((p) => p.id === leaders[0]);
        room.phase = 'playing'; room.canRoll = true;
        room.startingRound = undefined;
        pushLog(room, currentPlayer(room).name + ' goes first with ' + highest + '. Roll to begin your turn.');
      }
    }
    return room;
  }

  rollDice(socketId: string, chosenDie?: number): RoomState {
    const room = this.requireTurn(socketId);
    if (!room.canRoll || room.pending.type !== 'none') throw new Error('Cannot roll now');
    const player = currentPlayer(room);

    if (player.inJail) {
      room.pending = { type: 'jail_choice' };
      room.canRoll = false;
      return room;
    }

    if (player.dieChoice === 'ready') {
      if (chosenDie === undefined || !Number.isInteger(chosenDie) || chosenDie < 1 || chosenDie > 6) {
        throw new Error('Choose a die face from 1 to 6.');
      }
      delete player.dieChoice;
    } else if (chosenDie !== undefined) {
      throw new Error('You do not have a die choice for this roll.');
    }
    const d1 = chosenDie ?? 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    room.lastDice = [d1, d2];
    room.lastRollId = (room.lastRollId ?? 0) + 1;
    const total = d1 + d2;
    const doubles = d1 === d2;
    room.extraRollEligible = doubles;

    if (doubles) room.doublesCount += 1;
    else room.doublesCount = 0;

    if (room.doublesCount >= 3) {
      pushLog(room, `${player.name} rolled three doubles and acquired skin condition.`);
      sendToJail(room, player);
      return room;
    }

    pushLog(room, `${player.name} rolled ${d1}+${d2}=${total}${doubles ? ' (doubles)' : ''}.`);
    resolveMovementRoll(room, player, total);

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
    startPropertyAuction(room, space.id);
    if (!room.auction) this.afterAction(room);
    return room;
  }

  acknowledgePay(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    const player = currentPlayer(room);
    const pending = room.pending;
    if (pending.type !== 'pay_rent' && pending.type !== 'pay_tax') throw new Error('No payment pending');
    room.pending = { type: 'none' };
    charge(room, player, pending.amount, pending.type === 'pay_rent' ? pending.toPlayerId : null,
      pending.type === 'pay_rent' ? 'rent at ' + spaceAt(room, pending.spaceId).name : 'tax');
    if (room.pending.type === 'none') this.afterAction(room);
    return room;
  }

  acknowledgeCard(socketId: string, wager?: number): RoomState {
    const room = this.requireTurn(socketId);
    if (room.pending.type !== 'card') throw new Error('No card pending');
    const player = currentPlayer(room);
    const { card, deck } = room.pending;
    if (card.effect.type === 'sports_bet') {
      if (wager === undefined || !Number.isSafeInteger(wager) || wager < 0 || wager > player.money) {
        throw new Error('Choose a whole wager from 0 up to your available Carats.');
      }
      if (!Number.isSafeInteger(wager * 4) ||
        !Number.isSafeInteger(player.money - wager + caratGain(player, wager * 4))) {
        throw new Error('Choose a smaller wager.');
      }
    }
    if (card.effect.type === 'get_out_of_jail') {
      room.heldCards ??= {}; room.heldCards[player.id] ??= [];
      room.heldCards[player.id].push({ deck, id: card.id });
    } else returnCard(room, deck, card.id);
    applyCardEffect(room, player, card, wager);
    if ((room.pending as PendingAction).type === 'none' && room.phase === 'playing' && !player.inJail) {
      this.afterAction(room);
    }
    return room;
  }

  jailAction(socketId: string, action: 'pay' | 'card' | 'roll'): RoomState {
    if (!['pay', 'card', 'roll'].includes(action)) throw new Error('Invalid Infirmary action.');
    const room = this.requireTurn(socketId);
    const player = currentPlayer(room);
    if (!player.inJail) throw new Error('Not in Infirmary');

    if (room.pending.type === 'none' && room.canRoll) {
      room.pending = { type: 'jail_choice' };
      room.canRoll = false;
    }
    if (room.pending.type !== 'jail_choice') throw new Error('No jail choice');

    if (action === 'pay') {
      room.pending = { type: 'none' };
      room.debtResume = { kind: 'jail_exit' };
      if (charge(room, player, JAIL_FINE, null, 'leaving the Infirmary')) {
        room.debtResume = undefined;
        player.inJail = false; player.jailTurns = 0; room.canRoll = true;
      }
      return room;
    }

    if (action === 'card') {
      if (player.getOutCards < 1) throw new Error('No free pass');
      movePasses(room, player.id, null, 1);
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
    room.lastRollId = (room.lastRollId ?? 0) + 1;
    room.extraRollEligible = false;
    if (d1 === d2) {
      player.inJail = false;
      player.jailTurns = 0;
      pushLog(room, `${player.name} rolled doubles (${d1}+${d2}) and leaves Infirmary!`);
      room.pending = { type: 'none' };
      resolveMovementRoll(room, player, d1 + d2);
      if (room.pending.type === 'none') this.afterAction(room);
      return room;
    }

    player.jailTurns += 1;
    pushLog(room, `${player.name} failed to roll doubles (${d1}+${d2}).`);
    if (player.jailTurns >= 3) {
      room.pending = { type: 'none' };
      room.debtResume = { kind: 'jail_roll', steps: d1 + d2 };
      charge(room, player, JAIL_FINE, null, 'mandatory Infirmary exit after three turns');
      this.continueEconomy(room);
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
      const auction = room.auction;
      if (auction && !player.bankrupt && auction.eligible.includes(player.id) && !auction.passed.includes(player.id) && auction.highBidderId !== player.id) {
        auctionAction(room, player.id, auction.id, null);
        if (!room.auction) this.continueEconomy(room);
      }
    }

    if (room.players.every((p) => !p.connected)) {
      this.scheduleRoomCleanup(room.code);
    } else if (room.hostId === binding.playerId) {
      this.scheduleHostTransfer(room.code, binding.playerId);
    }

    return room;
  }

  proposeTrade(socketId: string, input: TradeProposal): RoomState {
    const { room, playerId } = this.requirePlayer(socketId); proposeTrade(room, playerId, input); return room;
  }
  respondToTrade(socketId: string, input: TradeResponse): RoomState {
    const { room, playerId } = this.requirePlayer(socketId); respondToTrade(room, playerId, input); return room;
  }
  propertyAction(socketId: string, spaceId: number, action: PropertyAction): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    manageProperty(room, playerId, spaceId, action);
    return room;
  }

  auctionAction(socketId: string, auctionId: string, amount: number | null, targetId?: number): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    auctionAction(room, playerId, auctionId, amount, targetId);
    if (!room.auction) this.continueEconomy(room);
    return room;
  }

  debtAction(socketId: string, debtId: string, bankrupt: boolean): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    settleDebt(room, playerId, debtId, bankrupt);
    this.continueEconomy(room);
    return room;
  }

  declareBankruptcy(socketId: string): RoomState {
    const room = this.requireTurn(socketId);
    const player = currentPlayer(room);
    const pending = room.pending;
    let creditor: PlayerPublic | undefined;
    if (pending.type === 'pay_rent') {
      if (player.money >= pending.amount) {
        charge(room, player, pending.amount, pending.toPlayerId, 'rent at ' + spaceAt(room, pending.spaceId).name);
      } else {
        if (liquidationValue(room, player.id) >= pending.amount) {
          throw new Error('Your assets can cover this rent. Settle the rent before declaring bankruptcy.');
        }
        creditor = activePlayers(room).find((other) => other.id === pending.toPlayerId);
      }
    }
    if (pending.type === 'card') returnCard(room, pending.deck, pending.card.id);
    room.pending = { type: 'none' };
    liquidatePlayer(room, player, creditor);
    if (pending.type === 'buy_or_pass') {
      room.auctionQueue ??= [];
      room.auctionQueue.push(pending.spaceId);
    }
    this.continueEconomy(room);
    return room;
  }

  private continueEconomy(room: RoomState) {
    if (room.auction) return;
    if (!room.debts?.length) {
      if (room.pending.type === 'debt') room.pending = { type: 'none' };
      while (room.auctionQueue?.length) {
        startPropertyAuction(room, room.auctionQueue.shift()!);
        if (room.auction) return;
      }
    }
    checkWinner(room);
    if (room.phase === 'finished') { room.auction = null; room.auctionQueue = []; room.debts = []; return; }
    if (room.debts?.length) { room.pending = { type: 'debt' }; return; }
    const player = currentPlayer(room);
    const resume = room.debtResume; room.debtResume = undefined;
    if (player.bankrupt) { this.endTurn(room); return; }
    if (resume?.kind === 'jail_exit') {
      player.inJail = false; player.jailTurns = 0; room.canRoll = true; return;
    }
    if (resume?.kind === 'jail_roll') {
      player.inJail = false; player.jailTurns = 0;
      resolveMovementRoll(room, player, resume.steps);
    }
    if (room.auctionResumeCanRoll !== undefined) {
      room.canRoll = room.auctionResumeCanRoll; room.auctionResumeCanRoll = undefined;
    } else if (room.pending.type === 'none') this.afterAction(room);
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
    const doubles = room.extraRollEligible === true;
    if (doubles && !player.inJail && !player.bankrupt) {
      room.canRoll = true;
    } else {
      room.canRoll = false;
    }
  }

  private endTurn(room: RoomState) {
    if (room.phase !== 'playing') return;
    const player = currentPlayer(room);
    if (player.dieChoice === 'ready') delete player.dieChoice;
    for (const kind of TURN_MODIFIERS) {
      const effects = player[kind];
      if (!effects) continue;
      for (const effect of effects) {
        if (!effect.startsNextTurn) effect.turns -= 1;
      }
      player[kind] = effects.filter((effect) => effect.turns > 0);
    }
    room.doublesCount = 0;
    room.extraRollEligible = false;
    room.lastDice = null;
    room.turnIndex = nextAliveIndex(room, room.turnIndex);
    room.pending = { type: 'none' };
    while ((currentPlayer(room).skippedTurns ?? 0) > 0) {
      const skipped = currentPlayer(room);
      skipped.skippedTurns! -= 1;
      pushLog(room, `${skipped.name} skips their turn.`);
      room.turnIndex = nextAliveIndex(room, room.turnIndex);
    }
    const next = currentPlayer(room);
    if (next.dieChoice === 'next_turn') next.dieChoice = 'ready';
    for (const kind of TURN_MODIFIERS) {
      for (const effect of next[kind] ?? []) delete effect.startsNextTurn;
    }
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

  private requireLobby(socketId: string) {
    const binding = this.requirePlayer(socketId);
    if (binding.room.phase !== 'lobby' && binding.room.phase !== 'config') {
      throw new Error('The lobby is closed because the game has started.');
    }
    return binding;
  }

  private requireTurn(socketId: string): RoomState {
    const { room, playerId } = this.requirePlayer(socketId);
    if (room.phase !== 'playing') throw new Error('Game not in progress');
    if (room.auction || room.debts?.length) throw new Error('Resolve the auction or outstanding debt first.');
    if (currentPlayer(room).id !== playerId) throw new Error('Not your turn');
    if (currentPlayer(room).bankrupt) throw new Error('You are out');
    return room;
  }
}

export type { PendingAction };
