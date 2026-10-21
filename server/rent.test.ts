import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';
import { calculateRent } from '../src/lib/rent.js';

function setup() {
  const manager = new RoomManager();
  const room = manager.createRoom('alice', 'socket-a', 'Alice');
  manager.joinRoom(room.code, 'bob', 'socket-b', 'Bob');
  room.phase = 'playing';
  room.canRoll = true;
  const landOn = (position: number) => {
    room.pending = { type: 'card', deck: 'chance', card: {
      id: 'test', text: 'Move', effect: { type: 'move', position },
    } };
    manager.acknowledgeCard('socket-a');
  };
  return { manager, room, landOn };
}

test('property rent doubles for a complete group and transfers to its owner once', () => {
  const { manager, room, landOn } = setup();
  room.ownership[1] = 'bob';
  const tile = room.content.properties.find((space) => space.id === 1)!;
  assert.equal(calculateRent(room, tile, 7), 2);
  room.ownership[3] = 'bob';
  assert.equal(calculateRent(room, tile, 7), 4);
  landOn(1);
  assert.deepEqual(room.pending, { type: 'pay_rent', toPlayerId: 'bob', amount: 4, spaceId: 1 });
  assert.throws(() => manager.acknowledgePay('socket-b'), /Not your turn/);
  manager.acknowledgePay('socket-a');
  assert.equal(room.players[0].money, 1496);
  assert.equal(room.players[1].money, 1504);
  assert.throws(() => manager.acknowledgePay('socket-a'), /No payment pending/);
});

test('transport rent scales with the number owned', () => {
  const { room, landOn } = setup();
  [5, 15, 25, 35].forEach((id, index) => {
    room.ownership[id] = 'bob';
    landOn(5);
    assert.equal(room.pending.type, 'pay_rent');
    if (room.pending.type === 'pay_rent') assert.equal(room.pending.amount, [25, 50, 100, 200][index]);
  });
});

test('utility rent uses the dice total and changes when both are owned', () => {
  const { room, landOn } = setup();
  room.lastDice = [3, 4];
  room.ownership[12] = 'bob';
  landOn(12);
  assert.equal(room.pending.type === 'pay_rent' && room.pending.amount, 28);
  room.ownership[28] = 'bob';
  landOn(12);
  assert.equal(room.pending.type === 'pay_rent' && room.pending.amount, 70);
});

test('unowned tiles offer purchase and owners do not pay themselves', () => {
  const { room, landOn } = setup();
  landOn(1);
  assert.equal(room.pending.type, 'buy_or_pass');
  room.ownership[3] = 'alice';
  landOn(3);
  assert.equal(room.pending.type, 'none');
  assert.equal(room.players[0].money, 1500);
});

test('unaffordable rent eliminates the payer and releases their property', () => {
  const { manager, room, landOn } = setup();
  room.players[0].money = 1;
  room.ownership[1] = 'bob';
  room.ownership[3] = 'alice';
  landOn(1);
  manager.acknowledgePay('socket-a');
  assert.equal(room.players[0].bankrupt, true);
  assert.equal(room.ownership[3], undefined);
  assert.equal(room.winnerId, 'bob');
});
