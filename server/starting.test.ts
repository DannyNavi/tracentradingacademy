import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';

function setup() {
  const manager = new RoomManager(); const room = manager.createRoom('a','sa','Alice');
  manager.joinRoom(room.code,'b','sb','Bob'); manager.joinRoom(room.code,'c','sc','Cara');
  room.players.forEach((p) => { p.characterId = p.id; });
  manager.startGame('sa');
  const roll = (socket: string, total: 'low' | 'medium' | 'high', round = room.startingRound!.number) => {
    const original = Math.random;
    Math.random = () => total === 'low' ? 0 : total === 'medium' ? 0.5 : 0.99;
    try { manager.rollStartingDice(socket, round); } finally { Math.random = original; }
  };
  return { manager, room, roll };
}

test('each player must roll personally; only tied highest players reroll and the winner goes first', () => {
  const { manager, room, roll } = setup();
  assert.equal(room.phase, 'starting'); assert.deepEqual(room.startRolls, []); assert.equal(room.canRoll, false);
  assert.throws(() => manager.rollDice('sa'), /not in progress/);
  roll('sa','medium'); roll('sb','medium');
  assert.equal(room.phase, 'starting'); assert.equal(room.startingRound!.number, 1);
  roll('sc','low');
  assert.equal(room.startingRound!.number, 2); assert.deepEqual(room.startingRound!.eligibleIds, ['a','b']);
  assert.throws(() => roll('sc','high'), /Only players tied/);
  roll('sa','medium'); roll('sb','high');
  assert.equal(room.phase, 'playing'); assert.equal(room.turnIndex, 1); assert.equal(room.canRoll, true);
  assert.equal(room.startingRound, undefined); assert.equal(room.startRolls!.length, 5);
  assert.ok(room.players.every((p) => p.position === 0 && p.money === 1500));
  assert.equal(room.lastDice, null); assert.equal(room.lastRollId, undefined);
  assert.throws(() => manager.rollDice('sa'), /Not your turn/);
  assert.throws(() => manager.rollStartingDice('sb',2), /already finished/);
});

test('duplicate and stale-round requests cannot roll twice or sneak into a tiebreak', () => {
  const { manager, room, roll } = setup();
  roll('sa','high');
  assert.throws(() => roll('sa','low'), /already rolled/);
  assert.throws(() => manager.rollStartingDice('unknown',1), /Not in a lobby/);
  assert.throws(() => manager.rollStartingDice('sb',0), /round has ended/);
  roll('sb','high'); roll('sc','low');
  assert.throws(() => roll('sb','high',1), /round has ended/);
  assert.equal(room.startRolls!.length, 3); assert.deepEqual(room.startingRound!.rolls, {});
});

test('repeated highest ties keep creating new rounds without including eliminated contenders', () => {
  const { room, roll } = setup();
  roll('sa','high'); roll('sb','high'); roll('sc','low');
  roll('sb','medium'); roll('sa','medium');
  assert.equal(room.startingRound!.number, 3); assert.deepEqual(room.startingRound!.eligibleIds,['a','b']);
  roll('sb','low'); roll('sa','medium');
  assert.equal(room.phase,'playing'); assert.equal(room.turnIndex,0);
});

test('lower totals tying does not trigger a reroll when there is one highest player', () => {
  const { room, roll } = setup();
  roll('sc','low'); roll('sa','high'); roll('sb','low');
  assert.equal(room.phase,'playing'); assert.equal(room.turnIndex,0);
  assert.equal(room.startRolls!.length,3);
});

test('starting rolls survive reconnection and new players cannot join after selection begins', () => {
  const { manager, room, roll } = setup(); roll('sa','high');
  manager.rejoinRoom(room.code,'a','sa-new');
  assert.deepEqual(room.startingRound!.rolls.a,[6,6]);
  assert.throws(() => manager.rollStartingDice('sa-new',1), /already rolled/);
  assert.throws(() => manager.rollStartingDice('sa',1), /Not in a lobby/);
  assert.throws(() => manager.joinRoom(room.code,'d','sd','Dan'), /already started/);
  assert.throws(() => manager.startGame('sa-new'), /already started/);
});
