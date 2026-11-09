import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';
import { refreshTrades } from './trading.js';
import type { TradeAssets, TradeProposal } from '../shared/trades.js';

const assets = (money = 0, propertyIds: number[] = [], freePasses = 0): TradeAssets => ({ money, propertyIds, freePasses });

function setup() {
  const manager = new RoomManager();
  const room = manager.createRoom('a', 'sa', 'Alice');
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.joinRoom(room.code, 'c', 'sc', 'Cara');
  room.phase = 'playing'; room.canRoll = true;
  room.ownership = { 1: 'a', 3: 'b', 6: 'c' };
  room.players[0].getOutCards = 1;
  room.players[1].getOutCards = 2;
  const proposal: TradeProposal = { toPlayerId: 'b', give: assets(100, [1], 1), receive: assets(50, [3], 2) };
  const send = () => { manager.proposeTrade('sa', proposal); return room.trades!.at(-1)!; };
  return { manager, room, proposal, send };
}

test('both players explicitly agree before an atomic exchange of all asset types', () => {
  const { manager, room, send } = setup();
  const trade = send();
  assert.deepEqual(trade.approvedBy, []);
  assert.equal(room.ownership[1], 'a');
  manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'agree' });
  manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'agree' });
  assert.equal(trade.status, 'pending');
  assert.equal(room.players[0].money, 1500);
  assert.deepEqual(trade.approvedBy, ['b']);
  manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' });
  assert.equal(trade.status, 'completed');
  assert.deepEqual(room.players.slice(0, 2).map((p) => [p.money, p.getOutCards]), [[1450, 2], [1550, 1]]);
  assert.deepEqual(room.ownership, { 1: 'b', 3: 'a', 6: 'c' });
  assert.throws(() => manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' }), /already closed/);
});

test('counteroffers preserve perspective, revoke approvals, and reject old-version responses', () => {
  const { manager, room, send } = setup();
  const trade = send();
  manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' });
  manager.proposeTrade('sb', { tradeId: trade.id, revision: 1, toPlayerId: 'a', give: assets(200, [3]), receive: assets(0, [1]) });
  assert.equal(trade.revision, 2);
  assert.deepEqual(trade.approvedBy, []);
  assert.deepEqual(trade.giveA, assets(0, [1]));
  assert.deepEqual(trade.giveB, assets(200, [3]));
  assert.throws(() => manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' }), /changed/);
  manager.respondToTrade('sa', { tradeId: trade.id, revision: 2, action: 'agree' });
  assert.equal(room.ownership[1], 'a');
  manager.respondToTrade('sb', { tradeId: trade.id, revision: 2, action: 'agree' });
  assert.equal(trade.status, 'completed');
  assert.equal(room.players[0].money, 1700);
});

test('recipient refusal and proposer withdrawal do not transfer assets', () => {
  for (const [socket, expected] of [['sb', 'declined'], ['sa', 'cancelled']]) {
    const { manager, room, send } = setup(); const trade = send();
    manager.respondToTrade(socket, { tradeId: trade.id, revision: 1, action: 'decline' });
    assert.equal(trade.status, expected);
    assert.equal(room.players[0].money, 1500);
    assert.equal(room.ownership[1], 'a');
  }
});

test('third parties cannot respond, counter, or replace the other trader', () => {
  const { manager, room, send } = setup(); const trade = send();
  assert.throws(() => manager.respondToTrade('sc', { tradeId: trade.id, revision: 1, action: 'agree' }), /not found/);
  assert.throws(() => manager.proposeTrade('sc', { tradeId: trade.id, revision: 1, toPlayerId: 'a', give: assets(1), receive: assets() }), /not found/);
  assert.throws(() => manager.proposeTrade('sa', { tradeId: trade.id, revision: 1, toPlayerId: 'c', give: assets(1), receive: assets() }), /same player/);
  assert.equal(room.trades!.length, 1);
});

test('malformed, negative, fractional, duplicate, missing, and unowned assets are rejected', () => {
  const badAssets = [assets(-1), assets(1.5), assets(NaN), assets(Infinity), assets(1501), assets(0, [1, 1]), assets(0, [3]), assets(0, [99]), assets(0, [], 2), assets(0, [], -1)];
  for (const give of badAssets) {
    const { manager, room, proposal } = setup();
    assert.throws(() => manager.proposeTrade('sa', { ...proposal, give }));
    assert.equal(room.trades?.length ?? 0, 0);
  }
  const { manager } = setup();
  assert.throws(() => manager.proposeTrade('sa', { toPlayerId: 'a', give: assets(1), receive: assets() }), /another player/);
  assert.throws(() => manager.proposeTrade('sa', { toPlayerId: 'b', give: assets(), receive: assets() }), /Add carats/);
});

test('game actions block proposals and agreements while refusal remains available', () => {
  const { manager, room, proposal, send } = setup(); const trade = send();
  room.pending = { type: 'pay_rent', toPlayerId: 'b', spaceId: 3, amount: 4 };
  assert.throws(() => manager.proposeTrade('sc', { ...proposal, toPlayerId: 'a', give: assets(1), receive: assets() }), /current game action/);
  assert.throws(() => manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'agree' }), /current game action/);
  manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'decline' });
  assert.equal(trade.status, 'declined');
});

test('assets are checked again at agreement and failed trades have no partial transfers', () => {
  for (const change of ['money', 'property', 'pass']) {
    const { manager, room, send } = setup(); const trade = send();
    manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' });
    if (change === 'money') room.players[0].money = 10;
    if (change === 'property') room.ownership[1] = 'c';
    if (change === 'pass') room.players[0].getOutCards = 0;
    const before = structuredClone({ players: room.players, ownership: room.ownership });
    assert.throws(() => manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'agree' }));
    assert.deepEqual({ players: room.players, ownership: room.ownership }, before);
    refreshTrades(room);
    assert.equal(trade.status, 'invalidated');
    assert.deepEqual(trade.approvedBy, []);
  }
});

test('completing a trade invalidates overlapping offers', () => {
  const { manager, room, send } = setup(); const trade = send();
  manager.proposeTrade('sa', { toPlayerId: 'c', give: assets(0, [1]), receive: assets(10) });
  const overlapping = room.trades!.at(-1)!;
  manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' });
  manager.respondToTrade('sb', { tradeId: trade.id, revision: 1, action: 'agree' });
  assert.equal(overlapping.status, 'invalidated');
});

test('offline players cannot finalize and closed games or bankruptcies invalidate offers', () => {
  const { manager, room, send } = setup(); const trade = send();
  room.players[1].connected = false;
  assert.throws(() => manager.respondToTrade('sa', { tradeId: trade.id, revision: 1, action: 'agree' }), /connected/);
  room.players[1].connected = true;
  room.players[1].bankrupt = true;
  refreshTrades(room);
  assert.equal(trade.status, 'invalidated');
  const fresh = setup(); const offer = fresh.send(); fresh.room.phase = 'finished'; refreshTrades(fresh.room);
  assert.equal(offer.status, 'invalidated');
});

test('one open negotiation per pair, including reversed proposals', () => {
  const { manager, proposal, send } = setup(); send();
  assert.throws(() => manager.proposeTrade('sa', proposal), /already have an open offer/);
  assert.throws(() => manager.proposeTrade('sb', { toPlayerId: 'a', give: assets(1), receive: assets() }), /already have an open offer/);
});
