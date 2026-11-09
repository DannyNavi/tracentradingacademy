import { randomUUID } from 'node:crypto';
import { buildingLevel, mortgageValue, propertyGroup } from '../shared/rules.js';
import { movePasses } from './cards.js';
import type { Trade, TradeAssets, TradeProposal, TradeResponse } from '../shared/trades.js';
import type { PlayerPublic, RoomState } from './types.js';

function participant(room: RoomState, id: string) {
  const player = room.players.find((p) => p.id === id);
  if (!player || player.bankrupt) throw new Error('Both traders must still be in the game.');
  return player;
}

function requireTradingWindow(room: RoomState) {
  if (room.phase !== 'playing') throw new Error('Trading is available during the game.');
  if (room.auction || (room.pending.type !== 'none' && room.pending.type !== 'debt')) throw new Error('Finish the current game action before sending or agreeing to a trade.');
}

function validateAssets(room: RoomState, player: PlayerPublic, assets: TradeAssets) {
  if (!assets || !Number.isSafeInteger(assets.money) || assets.money < 0 ||
    !Number.isSafeInteger(assets.freePasses) || assets.freePasses < 0 ||
    !Array.isArray(assets.propertyIds) || assets.propertyIds.length > 40 ||
    assets.propertyIds.some((id) => !Number.isSafeInteger(id)) ||
    new Set(assets.propertyIds).size !== assets.propertyIds.length) {
    throw new Error('Use whole, non-negative amounts and select each property only once.');
  }
  if (assets.money > player.money) throw new Error(`${player.name} no longer has enough carats for this offer.`);
  if (assets.freePasses > player.getOutCards) throw new Error(`${player.name} no longer has enough free passes for this offer.`);
  for (const id of assets.propertyIds) {
    const space = room.content.properties.find((s) => s.id === id);
    if (!space || !['property', 'rail', 'utility'].includes(space.kind) || room.ownership[id] !== player.id) {
      throw new Error(`${player.name} no longer owns every property in this offer.`);
    }
    if (propertyGroup(room, space).some((s) => buildingLevel(room, s.id))) throw new Error('Sell all buildings in a property group before trading any property in that group.');
  }
}

function validateTrade(room: RoomState, trade: Trade) {
  const a = participant(room, trade.playerAId);
  const b = participant(room, trade.playerBId);
  validateAssets(room, a, trade.giveA);
  validateAssets(room, b, trade.giveB);
  if (!Number.isSafeInteger(a.money - trade.giveA.money + trade.giveB.money) ||
    !Number.isSafeInteger(b.money - trade.giveB.money + trade.giveA.money)) {
    throw new Error('The resulting balance is too large.');
  }
  const fee = (ids: number[]) => ids.reduce((sum, id) => sum + (room.mortgaged?.[id] ? Math.ceil(mortgageValue(room.content.properties.find((s) => s.id === id)!) / 10) : 0), 0);
  const feeA = fee(trade.giveB.propertyIds), feeB = fee(trade.giveA.propertyIds);
  if (a.money - trade.giveA.money + trade.giveB.money < feeA || b.money - trade.giveB.money + trade.giveA.money < feeB) throw new Error('The new owner must be able to pay 10% interest on incoming mortgaged property.');
  return { a, b, feeA, feeB };
}

function log(room: RoomState, message: string) {
  room.log = [message, ...room.log].slice(0, 40);
}

function findTrade(room: RoomState, playerId: string, id: string, revision: number) {
  const trade = room.trades?.find((offer) => offer.id === id);
  if (!trade || (trade.playerAId !== playerId && trade.playerBId !== playerId)) throw new Error('Trade not found.');
  if (trade.status !== 'pending') throw new Error('This trade is already closed.');
  if (trade.revision !== revision) throw new Error('This offer has changed. Review the latest version before responding.');
  return trade;
}

export function proposeTrade(room: RoomState, playerId: string, input: TradeProposal) {
  requireTradingWindow(room);
  if (!input || typeof input.toPlayerId !== 'string' || input.toPlayerId === playerId) throw new Error('Choose another player to trade with.');
  const sender = participant(room, playerId);
  const recipient = participant(room, input.toPlayerId);
  if (!sender.connected || !recipient.connected) throw new Error('Both players must be connected to negotiate.');
  const existing = input.tradeId ? findTrade(room, playerId, input.tradeId, input.revision!) : undefined;
  if (existing && ![existing.playerAId, existing.playerBId].includes(input.toPlayerId)) throw new Error('A counteroffer must be sent to the same player.');
  if (!existing && room.trades?.some((trade) => trade.status === 'pending' &&
    [trade.playerAId, trade.playerBId].includes(playerId) && [trade.playerAId, trade.playerBId].includes(input.toPlayerId))) {
    throw new Error('You already have an open offer with this player. Review or counter that offer.');
  }
  validateAssets(room, sender, input.give);
  validateAssets(room, recipient, input.receive);
  if (![input.give, input.receive].some((assets) => assets.money || assets.freePasses || assets.propertyIds.length)) throw new Error('Add carats, properties, or free passes to the offer.');
  const isA = !existing || existing.playerAId === playerId;
  const trade: Trade = {
    id: existing?.id ?? randomUUID(),
    playerAId: existing?.playerAId ?? playerId,
    playerBId: existing?.playerBId ?? input.toPlayerId,
    giveA: structuredClone(isA ? input.give : input.receive),
    giveB: structuredClone(isA ? input.receive : input.give),
    proposedBy: playerId,
    revision: (existing?.revision ?? 0) + 1,
    approvedBy: [],
    status: 'pending',
  };
  validateTrade(room, trade);
  if (existing) Object.assign(existing, trade);
  else {
    // Retain all open offers and a short history of completed negotiations.
    room.trades = [...(room.trades ?? []).filter((offer) => offer.status === 'pending'),
      ...(room.trades ?? []).filter((offer) => offer.status !== 'pending').slice(-15), trade];
  }
  log(room, `${sender.name} ${existing ? 'countered a trade with' : 'offered a trade to'} ${recipient.name}. Both players must agree.`);
}

export function respondToTrade(room: RoomState, playerId: string, input: TradeResponse) {
  if (!input || !['agree', 'decline'].includes(input.action)) throw new Error('Invalid trade response.');
  if (room.phase !== 'playing') throw new Error('The game has ended.');
  const player = participant(room, playerId);
  const trade = findTrade(room, playerId, input.tradeId, input.revision);
  if (input.action === 'decline') {
    trade.status = trade.proposedBy === playerId ? 'cancelled' : 'declined';
    trade.approvedBy = [];
    log(room, `${player.name} ${trade.status === 'cancelled' ? 'withdrew' : 'declined'} the trade.`);
    return;
  }
  requireTradingWindow(room);
  const { a, b, feeA, feeB } = validateTrade(room, trade);
  if (!a.connected || !b.connected) throw new Error('Wait until both players are connected before agreeing.');
  if (trade.approvedBy.includes(playerId)) return;
  trade.approvedBy.push(playerId);
  if (trade.approvedBy.length < 2) return;
  // All checks happen before any transfer; no partial payment or property swap.
  a.money += trade.giveB.money - trade.giveA.money - feeA;
  b.money += trade.giveA.money - trade.giveB.money - feeB;
  movePasses(room, a.id, b.id, trade.giveA.freePasses);
  movePasses(room, b.id, a.id, trade.giveB.freePasses);
  a.getOutCards += trade.giveB.freePasses - trade.giveA.freePasses;
  b.getOutCards += trade.giveA.freePasses - trade.giveB.freePasses;
  trade.giveA.propertyIds.forEach((id) => { room.ownership[id] = b.id; });
  trade.giveB.propertyIds.forEach((id) => { room.ownership[id] = a.id; });
  trade.status = 'completed';
  log(room, `${a.name} and ${b.name} completed their trade.`);
  refreshTrades(room);
}

/** Call after game updates so spent cash or transferred property revokes stale offers. */
export function refreshTrades(room: RoomState) {
  for (const trade of room.trades ?? []) {
    if (trade.status !== 'pending') continue;
    try {
      if (room.phase !== 'playing') throw new Error('The game has ended.');
      validateTrade(room, trade);
    } catch (error) {
      trade.status = 'invalidated';
      trade.reason = (error as Error).message;
      trade.approvedBy = [];
    }
  }
}
