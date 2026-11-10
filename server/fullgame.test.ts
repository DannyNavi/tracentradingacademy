import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';
import { bankSupply, buildingLevel, buildProblem, liquidationValue, propertyGroup } from '../shared/rules.js';

test('seeded complete games preserve money, ownership, building, and card-deck invariants', () => {
  const originalRandom = Math.random;
  try {
    for (const seed of [17, 42, 8]) {
      let randomState = seed;
      Math.random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
      const manager = new RoomManager();
      const room = manager.createRoom('a','sa','Alice'); manager.joinRoom(room.code,'b','sb','Bob');
      room.players.forEach((p) => { p.characterId = p.id; }); manager.startGame('sa');
      while (room.phase === 'starting') {
        const round = room.startingRound!;
        for (const id of round.eligibleIds) manager.rollStartingDice('s'+id, round.number);
      }
      let actions = 0;
      while (room.phase === 'playing' && actions++ < 10000) {
        const debt = room.debts?.[0];
        if (debt) {
          const debtor = room.players.find((p) => p.id === debt.playerId)!;
          if (debtor.money >= debt.amount) manager.debtAction('s'+debtor.id,debt.id,false);
          else if (liquidationValue(room,debtor.id) < debt.amount) manager.debtAction('s'+debtor.id,debt.id,true);
          else {
            const owned = room.content.properties.filter((s) => room.ownership[s.id] === debtor.id);
            const improved = owned.find((s) => buildingLevel(room,s.id) > 0);
            if (improved) manager.propertyAction('s'+debtor.id,improved.id,'sell_group');
            else {
              const property = owned.find((s) => !room.mortgaged?.[s.id])!;
              manager.propertyAction('s'+debtor.id,property.id,'mortgage');
            }
          }
        } else if (room.auction) {
          const auction = room.auction;
          const bidderId = auction.eligible.find((id) => !auction.passed.includes(id) && id !== auction.highBidderId)!;
          const bidder = room.players.find((p) => p.id === bidderId)!;
          const cap = Math.min(Math.floor(bidder.money / 2), 250);
          const amount = auction.highBid + 5;
          manager.auctionAction('s'+bidderId,auction.id,amount <= cap && Math.random() < 0.5 ? amount : null,auction.buildTargets?.[bidderId]?.[0]);
        } else {
          const player = room.players[room.turnIndex], socket = 's'+player.id;
          if (room.pending.type === 'buy_or_pass') {
            if (player.money >= room.pending.price + 100) manager.buy(socket); else manager.pass(socket);
          } else if (room.pending.type === 'pay_rent' || room.pending.type === 'pay_tax') manager.acknowledgePay(socket);
          else if (room.pending.type === 'card') manager.acknowledgeCard(socket);
          else if (player.inJail && room.canRoll) manager.jailAction(socket,player.getOutCards ? 'card' : player.money >= 100 ? 'pay' : 'roll');
          else if (room.pending.type === 'jail_choice') manager.jailAction(socket,'roll');
          else if (room.canRoll) manager.rollDice(socket, player.dieChoice === 'ready' ? 3 : undefined);
          else {
            const build = room.content.properties.find((s) => player.money >= 500 && !buildProblem(room,player.id,s));
            if (build) manager.propertyAction(socket,build.id,'build'); else manager.endTurnManual(socket);
          }
        }
        for (const player of room.players) {
          assert.ok(Number.isSafeInteger(player.money) && player.money >= 0, 'cash is a non-negative integer');
          assert.equal(player.getOutCards, room.heldCards?.[player.id]?.length ?? 0, 'held passes match their real cards');
        }
        for (const [spaceId, ownerId] of Object.entries(room.ownership)) {
          assert.equal(room.players.find((p) => p.id === ownerId)?.bankrupt, false, 'bankrupt players own no property');
          const space = room.content.properties.find((s) => s.id === Number(spaceId))!;
          const level = buildingLevel(room,space.id);
          assert.ok(level >= 0 && level <= 5);
          if (level) {
            const group = propertyGroup(room,space);
            assert.ok(group.every((s) => room.ownership[s.id] === ownerId && !room.mortgaged?.[s.id]));
            assert.ok(Math.max(...group.map((s) => buildingLevel(room,s.id))) - Math.min(...group.map((s) => buildingLevel(room,s.id))) <= 1);
          }
        }
        assert.ok(bankSupply(room).houses >= 0 && bankSupply(room).hotels >= 0);
        for (const deck of ['chance','community'] as const) {
          const available = room.cardDecks![deck];
          const held = Object.values(room.heldCards ?? {}).flat().filter((c) => c.deck === deck).map((c) => c.id);
          const pending = room.pending.type === 'card' && room.pending.deck === deck ? [room.pending.card.id] : [];
          assert.equal(new Set([...available,...held,...pending]).size,16, 'each card exists exactly once');
          assert.equal(available.length+held.length+pending.length,16);
        }
      }
      assert.equal(room.phase,'finished',`seed ${seed} should finish without a stalled game phase`);
      assert.equal(room.players.filter((p) => !p.bankrupt).length,1);
    }
  } finally { Math.random = originalRandom; }
});
