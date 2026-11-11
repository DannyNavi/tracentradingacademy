import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';
import { charge, startPropertyAuction } from './economy.js';
import { drawFromDeck, initializeDecks } from './cards.js';
import { bankSupply, buildingLevel } from '../shared/rules.js';
import { calculateRent } from '../src/lib/rent.js';
import type { CardEffect, GameCard } from './types.js';

const infirmaryPass: GameCard = { id: 'pass', text: 'Get out of Infirmary free.', effect: { type: 'get_out_of_jail' } };

function setup() {
  const manager = new RoomManager();
  const room = manager.createRoom('a', 'sa', 'Alice');
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.joinRoom(room.code, 'c', 'sc', 'Cara');
  room.phase = 'playing'; room.canRoll = true;
  room.buildings = {}; room.mortgaged = {}; room.debts = [];
  const own = (ids: number[], id = 'a') => ids.forEach((n) => { room.ownership[n] = id; });
  const playCard = (effect: CardEffect, d20Below?: number) => {
    room.pending = { type: 'card', deck: 'chance', card: { id: 'test', text: 'Test card', effect, d20Below } };
    manager.acknowledgeCard('sa');
  };
  return { manager, room, own, playCard };
}

function withDice(values: number[], run: () => void) {
  const original = Math.random; let i = 0;
  Math.random = () => values[i++ % values.length];
  try { run(); } finally { Math.random = original; }
}

test('building requires a complete unmortgaged group and progresses evenly to a hotel', () => {
  const { manager, room, own } = setup(); own([1]);
  assert.throws(() => manager.propertyAction('sa', 1, 'build'), /complete group/);
  own([3]);
  room.mortgaged![3] = true;
  assert.throws(() => manager.propertyAction('sa', 1, 'build'), /mortgages/);
  delete room.mortgaged![3];
  manager.propertyAction('sa', 1, 'build');
  assert.throws(() => manager.propertyAction('sa', 1, 'build'), /evenly/);
  manager.propertyAction('sa', 3, 'build');
  for (let i = 1; i < 4; i++) { manager.propertyAction('sa', 1, 'build'); manager.propertyAction('sa', 3, 'build'); }
  assert.deepEqual(bankSupply(room), { houses: 24, hotels: 12 });
  manager.propertyAction('sa', 1, 'build');
  assert.deepEqual(bankSupply(room), { houses: 28, hotels: 11 });
  assert.equal(buildingLevel(room, 1), 5);
  assert.equal(calculateRent(room, room.content.properties[1], 7), 250);
  assert.throws(() => manager.propertyAction('sa', 1, 'build'), /already has a hotel/);
});

test('buildings sell evenly at half price and a hotel downgrade restores four houses', () => {
  const { manager, room, own } = setup(); own([1, 3]); room.buildings = { 1: 2, 3: 1 };
  assert.throws(() => manager.propertyAction('sa', 3, 'sell'), /evenly/);
  manager.propertyAction('sa', 1, 'sell');
  assert.equal(room.players[0].money, 1525);
  room.buildings = { 1: 5, 3: 4 };
  manager.propertyAction('sa', 1, 'sell');
  assert.equal(room.buildings[1], 4);
  assert.equal(bankSupply(room).hotels, 12);
});

test('mortgage pays half value, stops rent, and redemption costs principal plus interest', () => {
  const { manager, room, own } = setup(); own([1, 3]);
  manager.propertyAction('sa', 1, 'mortgage');
  assert.equal(room.players[0].money, 1530);
  assert.equal(calculateRent(room, room.content.properties[1], 7), 0);
  assert.equal(calculateRent(room, room.content.properties[3], 7), 8);
  assert.throws(() => manager.propertyAction('sa', 1, 'mortgage'), /already mortgaged/);
  room.turnIndex = 1;
  assert.throws(() => manager.propertyAction('sa', 1, 'unmortgage'), /only repay mortgages on your turn/);
  assert.equal(room.players[0].money, 1530);
  assert.equal(room.mortgaged![1], true);
  room.turnIndex = 0;
  manager.propertyAction('sa', 1, 'unmortgage');
  assert.equal(room.players[0].money, 1497);
  room.buildings![3] = 1;
  assert.throws(() => manager.propertyAction('sa', 1, 'mortgage'), /Sell all buildings/);
  assert.throws(() => manager.propertyAction('sb', 1, 'sell'), /do not own/);
});

test('selling a whole group releases hotels when the bank cannot supply replacement houses', () => {
  const { manager, room, own } = setup(); own([1, 3]);
  room.buildings = { 1: 5, 3: 5, 6: 4, 8: 4, 9: 4, 11: 4, 13: 4, 14: 4, 16: 4, 18: 4 };
  assert.equal(bankSupply(room).houses, 0);
  assert.throws(() => manager.propertyAction('sa', 1, 'sell'), /four houses/);
  manager.propertyAction('sa', 1, 'sell_group');
  assert.equal(room.players[0].money, 1750);
  assert.equal(room.buildings[1], 0); assert.equal(room.buildings[3], 0);
});

test('passing a property starts a multiplayer auction and blocks normal game actions', () => {
  const { manager, room } = setup();
  room.pending = { type: 'buy_or_pass', spaceId: 1, price: 60 };
  manager.pass('sa'); const auction = room.auction!;
  assert.equal(auction.kind, 'property');
  assert.throws(() => manager.rollDice('sa'), /auction/);
  assert.throws(() => manager.auctionAction('sa', auction.id, -5), /whole amount/);
  assert.throws(() => manager.auctionAction('sa', auction.id, 1501), /afford/);
  assert.throws(() => manager.auctionAction('sa', auction.id, 9), /at least 10 Carats/);
  manager.auctionAction('sa', auction.id, 10);
  assert.throws(() => manager.auctionAction('sb', auction.id, 19), /at least 10 Carats/);
  manager.auctionAction('sb', auction.id, 20);
  manager.auctionAction('sa', auction.id, null);
  assert.throws(() => manager.auctionAction('sa', auction.id, 30), /not bidding/);
  manager.auctionAction('sc', auction.id, null);
  assert.equal(room.auction, null); assert.equal(room.ownership[1], 'b');
  assert.equal(room.players[1].money, 1480);
  assert.throws(() => manager.auctionAction('sb', auction.id, 30), /ended/);
});

test('all players may pass an auction without transferring property or cash', () => {
  const { manager, room } = setup(); startPropertyAuction(room, 1); const id = room.auction!.id;
  ['sa', 'sb', 'sc'].forEach((socket) => manager.auctionAction(socket, id, null));
  assert.equal(room.ownership[1], undefined); assert.equal(room.auction, null);
  assert.equal(room.players[0].money, 1500);
});

test('competition for the final house is auctioned to eligible group owners', () => {
  const { manager, room, own } = setup(); own([1,3,6,8,9,11,13,14,16,18,19]); own([21,23,24], 'b');
  room.buildings = { 1:4,3:4,6:4,8:4,9:4,11:3,13:3,14:3,16:1,18:1 };
  assert.equal(bankSupply(room).houses, 1);
  manager.propertyAction('sa', 19, 'build'); const auction = room.auction!;
  assert.equal(auction.kind, 'house');
  assert.throws(() => manager.auctionAction('sb', auction.id, 10, 1), /eligible/);
  manager.auctionAction('sb', auction.id, 75, 21);
  manager.auctionAction('sa', auction.id, null);
  assert.equal(room.buildings[21], 1); assert.equal(bankSupply(room).houses, 0);
  assert.equal(room.players[1].money, 1425);
  assert.equal(room.canRoll, true);
});

test('debt recovery pauses the game and allows mortgaging before payment', () => {
  const { manager, room, own } = setup(); own([1]); room.players[0].money = 10;
  room.pending = { type: 'pay_rent', toPlayerId: 'b', spaceId: 3, amount: 40 };
  manager.acknowledgePay('sa'); const debt = room.debts![0];
  assert.equal(room.players[1].money, 1500); assert.equal(room.players[0].bankrupt, false);
  assert.throws(() => manager.debtAction('sa', debt.id, true), /assets can cover/);
  assert.throws(() => manager.debtAction('sb', debt.id, false), /no longer outstanding/);
  assert.throws(() => manager.endTurnManual('sa'), /debt/);
  manager.propertyAction('sa', 1, 'mortgage'); manager.debtAction('sa', debt.id, false);
  assert.equal(room.players[0].money, 0); assert.equal(room.players[1].money, 1540);
  assert.equal(room.pending.type, 'none'); assert.equal(room.debts!.length, 0);
});

test('bankruptcy transfers actual cash and property to the creditor, not invented rent money', () => {
  const { manager, room, own } = setup(); own([1]); room.players[0].money = 1;
  charge(room, room.players[0], 100, 'b', 'rent');
  manager.debtAction('sa', room.debts![0].id, true);
  assert.equal(room.players[0].bankrupt, true); assert.equal(room.ownership[1], 'b');
  assert.equal(room.players[1].money, 1501); assert.equal(room.turnIndex, 1);
});

test('bank bankruptcy returns mortgage-free properties to sequential auctions before the next turn', () => {
  const { manager, room, own } = setup(); own([1,3]); room.players[0].money = 0; room.mortgaged![1] = true;
  charge(room, room.players[0], 200, null, 'tax');
  manager.debtAction('sa', room.debts![0].id, true);
  assert.equal(room.mortgaged![1], undefined); assert.equal(room.auction!.spaceId, 1);
  for (const spaceId of [1,3]) {
    const id = room.auction!.id; assert.equal(room.auction!.spaceId, spaceId);
    manager.auctionAction('sb', id, 10); manager.auctionAction('sc', id, null);
  }
  assert.equal(room.turnIndex, 1); assert.equal(room.canRoll, true);
  assert.equal(room.ownership[1], 'b'); assert.equal(room.ownership[3], 'b');
});

test('voluntary bankruptcy auctions all properties before naming the last player the winner', () => {
  const { manager, room, own } = setup();
  room.players.pop();
  own([1, 3, 5]);
  room.buildings = { 1: 1, 3: 1 };
  room.mortgaged = { 5: true };

  assert.throws(() => manager.declareBankruptcy('sb'), /Not your turn/);
  room.pending = { type: 'pay_tax', amount: 100 };
  manager.declareBankruptcy('sa');

  assert.equal(room.players[0].bankrupt, true);
  assert.equal(room.pending.type, 'none');
  assert.equal(room.players[0].money, 0);
  assert.deepEqual(room.ownership, {});
  assert.deepEqual(room.buildings, {});
  assert.deepEqual(room.mortgaged, {});
  for (const spaceId of [1, 3, 5]) {
    assert.equal(room.phase, 'playing');
    const auction = room.auction!;
    assert.equal(auction.spaceId, spaceId);
    assert.deepEqual(auction.eligible, ['b']);
    manager.auctionAction('sb', auction.id, spaceId === 3 ? null : 10);
  }
  assert.deepEqual(room.ownership, { 1: 'b', 5: 'b' });
  assert.equal(room.auction, null);
  assert.equal(room.phase, 'finished');
  assert.equal(room.winnerId, 'b');
});

test('bankruptcy without connected bidders releases properties and advances the turn', () => {
  const { manager, room, own } = setup();
  own([1, 3]);
  room.players[1].connected = false;
  room.players[2].connected = false;
  manager.declareBankruptcy('sa');
  assert.equal(room.auction, null);
  assert.deepEqual(room.auctionQueue, []);
  assert.deepEqual(room.ownership, {});
  assert.equal(room.turnIndex, 1);
  assert.equal(room.canRoll, true);
});

test('declaring bankruptcy with rent pending preserves the creditor’s claim', () => {
  const { manager, room, own } = setup();
  const player = room.players[0];
  own([1]);
  own([3], 'b');
  room.pending = { type: 'pay_rent', toPlayerId: 'b', amount: 100, spaceId: 3 };
  player.money = 80;
  assert.throws(() => manager.declareBankruptcy('sa'), /Settle the rent/);
  assert.equal(player.bankrupt, false);
  assert.equal(room.pending.type, 'pay_rent');
  player.money = 10;
  manager.declareBankruptcy('sa');
  assert.equal(player.bankrupt, true);
  assert.equal(room.players[1].money, 1510);
  assert.equal(room.ownership[1], 'b');
  assert.equal(room.turnIndex, 1);
});

test('bankruptcy during a card reveal returns the card to its deck', () => {
  const { manager, room } = setup();
  initializeDecks(room);
  const card = drawFromDeck(room, 'chance');
  room.pending = { type: 'card', deck: 'chance', card };
  manager.declareBankruptcy('sa');
  assert.equal(room.cardDecks!.chance.at(-1), card.id);
  assert.equal(room.pending.type, 'none');
  assert.equal(room.turnIndex, 1);
});

test('doubles used to leave jail never award an extra roll, including after landing actions', () => {
  const { manager, room, own } = setup(); room.players[0].position = 10; room.players[0].inJail = true;
  own([12]); room.extraRollEligible = true;
  withDice([0,0], () => manager.jailAction('sa', 'roll'));
  assert.equal(room.players[0].position, 12); assert.equal(room.players[0].inJail, false);
  assert.equal(room.canRoll, false); assert.equal(room.extraRollEligible, false);
  manager.endTurnManual('sa'); assert.equal(room.turnIndex, 1);
});

test('third failed jail roll waits for its fine to be funded before movement resumes', () => {
  const { manager, room, own } = setup(); own([1]);
  room.players[0].position = 10; room.players[0].inJail = true; room.players[0].jailTurns = 2; room.players[0].money = 20;
  withDice([0,0.2], () => manager.jailAction('sa', 'roll'));
  assert.equal(room.players[0].position, 10); assert.equal(room.pending.type, 'debt');
  manager.propertyAction('sa', 1, 'mortgage'); manager.debtAction('sa', room.debts![0].id, false);
  assert.equal(room.players[0].position, 13); assert.equal(room.players[0].inJail, false);
  assert.equal(room.pending.type, 'buy_or_pass');
});

test('shuffled cards cycle in order and held free-pass cards remain out of circulation', () => {
  const { manager, room } = setup();
  const card = infirmaryPass;
  room.content.community.push(card);
  initializeDecks(room);
  room.cardDecks!.community = [card.id, ...room.cardDecks!.community.filter((id) => id !== card.id)];
  const drawn = drawFromDeck(room, 'community');
  room.pending = { type: 'card', deck: 'community', card: drawn }; manager.acknowledgeCard('sa');
  assert.equal(room.players[0].getOutCards, 1); assert.equal(room.cardDecks!.community.includes(card.id), false);
  const next = room.cardDecks!.community[0]; const second = drawFromDeck(room, 'community'); assert.equal(second.id, next);
  room.pending = { type: 'card', deck: 'community', card: second }; manager.acknowledgeCard('sa');
  assert.equal(room.cardDecks!.community.at(-1), next);
  room.pending = { type: 'none' }; room.canRoll = true; room.players[0].inJail = true;
  manager.jailAction('sa', 'card'); assert.equal(room.cardDecks!.community.at(-1), card.id);
});

test('repair cards charge each house and hotel once; player-to-player cards use real participants', () => {
  const { room, own, playCard } = setup(); own([1,3]); room.buildings = { 1:3,3:5 };
  playCard({ type: 'repairs', house:25, hotel:100 }); assert.equal(room.players[0].money, 1325);
  playCard({ type: 'collect_each', amount:10 }); assert.deepEqual(room.players.map((p) => p.money), [1345,1490,1490]);
  playCard({ type: 'pay_each', amount:50 }); assert.deepEqual(room.players.map((p) => p.money), [1245,1540,1540]);
});

test('sports betting settles each d20 boundary using the chosen stake exactly once', () => {
  for (const [roll, multiplier] of [[1, 0], [10, 0], [11, 2], [18, 2], [19, 4], [20, 4]]) {
    const { manager, room } = setup();
    const card = room.content.community.find((card) => card.effect.type === 'sports_bet')!;
    room.pending = { type: 'card', deck: 'community', card };
    withDice([(roll - 0.5) / 20], () => manager.acknowledgeCard('sa', 100));
    assert.equal(room.players[0].money, 1400 + multiplier * 100);
    assert.deepEqual(room.lastD20Roll, {
      playerId: 'a', value: roll, penaltyApplies: multiplier === 0, wager: 100, payout: multiplier * 100,
    });
    assert.throws(() => manager.acknowledgeCard('sa', 100), /No card pending/);
  }
});

test('invalid sports wagers preserve the pending card and zero Carats is a valid wager', () => {
  const { manager, room } = setup();
  initializeDecks(room);
  const card = room.content.community.find((card) => card.effect.type === 'sports_bet')!;
  room.cardDecks!.community = room.cardDecks!.community.filter((id) => id !== card.id);
  room.pending = { type: 'card', deck: 'community', card };
  for (const wager of [undefined, -1, 0.5, NaN, 1501]) {
    assert.throws(() => manager.acknowledgeCard('sa', wager), /whole wager/);
    assert.equal(room.pending.type, 'card');
    assert.equal(room.players[0].money, 1500);
    assert.equal(room.cardDecks!.community.includes(card.id), false);
  }
  room.players[0].money = 0;
  withDice([0.99], () => manager.acknowledgeCard('sa', 0));
  assert.equal(room.players[0].money, 0);
  assert.equal(room.cardDecks!.community.at(-1), card.id);
});

test('Sweep Tosho boosts incoming payments, mortgages, trades, and rewards for three turns', () => {
  const { manager, room, own } = setup();
  const [alice, bob, cara] = room.players;
  const raffle = (id: string) => {
    room.pending = { type: 'card', deck: 'community', card: room.content.community.find((card) => card.id === id)! };
    manager.acknowledgeCard('sa');
  };
  own([1]);
  raffle('cm11');
  charge(room, bob, 50, alice.id, 'payment before the spell starts');
  assert.equal(alice.money, 1550);

  manager.endTurnManual('sa');
  room.canRoll = false; manager.endTurnManual('sb');
  room.canRoll = false; manager.endTurnManual('sc');
  manager.propertyAction('sa', 1, 'mortgage');
  assert.equal(alice.money, 1586);

  manager.proposeTrade('sa', {
    toPlayerId: 'b',
    give: { money: 0, propertyIds: [], freePasses: 0 },
    receive: { money: 100, propertyIds: [], freePasses: 0 },
  });
  const trade = room.trades![0];
  for (const socket of ['sa', 'sb']) manager.respondToTrade(socket, { tradeId: trade.id, revision: 1, action: 'agree' });
  assert.equal(alice.money, 1706);
  assert.equal(bob.money, 1350);

  raffle('cm16');
  assert.deepEqual(room.players.map((player) => player.money), [2426, 1950, 2100]);
  for (const turn of [1, 2, 3]) {
    room.canRoll = false; manager.endTurnManual('sa');
    charge(room, cara, 50, alice.id, 'payment between turns');
    assert.equal(alice.money, turn === 3 ? 2596 : 2426 + turn * 60);
    room.canRoll = false; manager.endTurnManual('sb');
    room.canRoll = false; manager.endTurnManual('sc');
  }
});

test('nearest transport cards charge double rent and mortgage exemptions still apply', () => {
  const { room, own, playCard } = setup(); own([5], 'b');
  playCard({ type: 'nearest_rail' });
  assert.equal(room.pending.type === 'pay_rent' && room.pending.amount, 50);
  room.pending = { type: 'none' }; room.players[0].position = 0; room.mortgaged![5] = true;
  playCard({ type: 'nearest_rail' }); assert.equal(room.pending.type, 'none');
});

test('the Hot Spring Getaway offers purchase when available and waives rent when owned', () => {
  const { room, own, playCard } = setup();
  const effect = { type: 'move', position: 37, rentFree: true } as const;
  playCard(effect);
  assert.deepEqual(room.pending, { type: 'buy_or_pass', spaceId: 37, price: 350 });
  own([37], 'b');
  playCard(effect);
  assert.equal(room.players[0].position, 37);
  assert.deepEqual(room.pending, { type: 'none' });
});

test('the Overwatch d20 check skips exactly two future turns on a roll below 10', () => {
  const { manager, room, playCard } = setup();
  const effect = { type: 'skip_turns', turns: 2 } as const;
  withDice([0.45], () => playCard(effect, 10));
  assert.equal(room.players[0].skippedTurns, undefined);
  assert.deepEqual(room.lastD20Roll, { playerId: 'a', value: 10, penaltyApplies: false });
  withDice([0.05], () => playCard(effect, 10));
  assert.deepEqual(room.lastD20Roll, { playerId: 'a', value: 2, penaltyApplies: true });
  manager.endTurnManual('sa');
  for (const next of [1, 1, 0]) {
    room.canRoll = false; manager.endTurnManual('sb');
    room.canRoll = false; manager.endTurnManual('sc');
    assert.equal(room.turnIndex, next);
  }
});

test('movement modifiers start next turn and expire after three played turns', () => {
  const { manager, room, own, playCard } = setup();
  const player = room.players[0];
  const effect = { type: 'movement_modifier', amount: -2, turns: 3 } as const;
  own([16, 18]);
  withDice([0.85], () => playCard(effect, 18));
  assert.equal(player.movementModifiers, undefined);
  room.extraRollEligible = true;
  withDice([0.8], () => playCard(effect, 18));
  player.position = 15;
  withDice([0, 0.2], () => manager.rollDice('sa'));
  assert.equal(player.position, 18);
  for (const expected of [16, 16, 16, 18]) {
    manager.endTurnManual('sa');
    room.canRoll = false; manager.endTurnManual('sb');
    room.canRoll = false; manager.endTurnManual('sc');
    player.position = 15;
    withDice([0, 0.2], () => manager.rollDice('sa'));
    assert.equal(player.position, expected);
  }
});

test('Maruzensky’s die choice is available once on the next turn', () => {
  const { manager, room, own, playCard } = setup();
  own([3, 8]);
  room.extraRollEligible = true;
  playCard({ type: 'choose_die' });
  assert.throws(() => manager.rollDice('sa', 6), /do not have a die choice/);
  withDice([0, 0.2], () => manager.rollDice('sa'));
  manager.endTurnManual('sa');
  room.canRoll = false; manager.endTurnManual('sb');
  room.canRoll = false; manager.endTurnManual('sc');
  assert.throws(() => manager.rollDice('sa'), /Choose a die face/);
  assert.throws(() => manager.rollDice('sa', 7), /Choose a die face/);
  withDice([0.5], () => manager.rollDice('sa', 1));
  assert.deepEqual(room.lastDice, [1, 4]);
  assert.equal(room.players[0].position, 8);
  assert.equal(room.players[0].dieChoice, undefined);
});

test('mortgaged-property trades charge incoming interest and preserve free-pass deck identity', () => {
  const { manager, room, own } = setup(); own([1]); room.mortgaged![1] = true;
  const pass = infirmaryPass;
  room.content.community.push(pass);
  room.heldCards = { a: [{ deck:'community', id:pass.id }] }; room.players[0].getOutCards = 1;
  manager.proposeTrade('sa', { toPlayerId:'b', give:{ money:0,propertyIds:[1],freePasses:1 }, receive:{ money:10,propertyIds:[],freePasses:0 } });
  const trade = room.trades![0];
  for (const socket of ['sa','sb']) manager.respondToTrade(socket, { tradeId:trade.id,revision:1,action:'agree' });
  assert.equal(room.players[1].money, 1487); assert.equal(room.ownership[1], 'b');
  assert.equal(room.heldCards.b[0].id, pass.id);
});

test('developed groups cannot be traded and debtors can trade to raise cash', () => {
  const { manager, room, own } = setup(); own([1,3]); room.buildings![3] = 1;
  const offer = { toPlayerId:'b', give:{ money:0,propertyIds:[1],freePasses:0 }, receive:{ money:100,propertyIds:[],freePasses:0 } };
  assert.throws(() => manager.proposeTrade('sa', offer), /Sell all buildings/);
  room.buildings = {}; room.players[0].money = 0; charge(room, room.players[0], 50, null, 'tax');
  manager.proposeTrade('sa', offer); const trade = room.trades![0];
  for (const socket of ['sa','sb']) manager.respondToTrade(socket, { tradeId:trade.id,revision:1,action:'agree' });
  manager.debtAction('sa', room.debts![0].id, false);
  assert.equal(room.players[0].money, 50); assert.equal(room.players[0].bankrupt, false);
});

test('nearest-utility cards roll only for rent and use ten times the fresh total', () => {
  const { manager, room, own, playCard } = setup(); own([12], 'b'); room.extraRollEligible = true;
  withDice([0,0.2], () => playCard({ type:'nearest_utility' }));
  assert.equal(room.pending.type === 'pay_rent' && room.pending.amount, 30);
  manager.acknowledgePay('sa'); assert.equal(room.canRoll, true);
  room.players[0].position = 0; delete room.ownership[12]; const rollId = room.lastRollId;
  playCard({ type:'nearest_utility' }); assert.equal(room.pending.type, 'buy_or_pass');
  assert.equal(room.lastRollId, rollId);
});

test('mortgaged inheritance charges interest to the recipient without inventing cash', () => {
  const { manager, room, own } = setup(); own([1]); room.mortgaged![1] = true; room.players[0].money = 0;
  charge(room, room.players[0], 100, 'b', 'rent'); manager.debtAction('sa', room.debts![0].id, true);
  assert.equal(room.ownership[1], 'b'); assert.equal(room.mortgaged![1], true);
  assert.equal(room.players[1].money, 1497);
});

test('bankruptcy from inherited mortgage interest auctions the property before naming the winner', () => {
  const { manager, room, own } = setup(); own([1]); room.mortgaged![1] = true;
  room.players[0].money = 0; room.players[1].money = 0;
  charge(room, room.players[0], 100, 'b', 'rent'); manager.debtAction('sa', room.debts![0].id, true);
  assert.equal(room.debts![0].playerId, 'b'); assert.equal(room.debts![0].amount, 3);
  manager.debtAction('sb', room.debts![0].id, true);
  assert.equal(room.auction?.spaceId, 1);
  assert.equal(room.phase, 'playing');
  manager.auctionAction('sc', room.auction!.id, null);
  assert.equal(room.phase, 'finished'); assert.equal(room.winnerId, 'c'); assert.equal(room.debts!.length, 0);
});

test('collect-from-each-player cards pause until an insolvent non-current player resolves their debt', () => {
  const { manager, room, own, playCard } = setup(); own([3], 'b'); room.players[1].money = 0;
  playCard({ type:'collect_each', amount:10 });
  assert.equal(room.pending.type, 'debt'); assert.equal(room.debts![0].playerId, 'b');
  assert.equal(room.players[0].money, 1510);
  manager.propertyAction('sb', 3, 'mortgage'); manager.debtAction('sb', room.debts![0].id, false);
  assert.equal(room.players[0].money, 1520); assert.equal(room.players[1].money, 20);
  assert.equal(room.turnIndex, 0); assert.equal(room.pending.type, 'none');
});

test('normal doubles still award a second roll after purchase and auction actions', () => {
  const { manager, room } = setup();
  withDice([0,0], () => manager.rollDice('sa'));
  assert.equal(room.pending.type, 'card');
  // The landing card may move the token, so use a purchase outcome to exercise turn continuation.
  room.pending = { type:'buy_or_pass',spaceId:1,price:60 };
  manager.buy('sa'); assert.equal(room.canRoll, true);
  room.pending = { type:'buy_or_pass',spaceId:3,price:60 };
  manager.pass('sa'); const id = room.auction!.id;
  ['sa','sb','sc'].forEach((socket) => manager.auctionAction(socket,id,null));
  assert.equal(room.canRoll, true);
});

test('a disconnected non-leading bidder does not leave an auction stuck', () => {
  const { manager, room } = setup(); startPropertyAuction(room,1); const id = room.auction!.id;
  manager.auctionAction('sa',id,10); manager.auctionAction('sc',id,null);
  manager.disconnect('sb');
  assert.equal(room.auction,null); assert.equal(room.ownership[1],'a');
  assert.equal(room.players[0].money,1490);
});
