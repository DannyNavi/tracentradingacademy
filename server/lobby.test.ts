import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from './game.js';

test('only the host can kick another player and that player cannot rejoin the lobby', () => {
  const manager = new RoomManager();
  const room = manager.createRoom('a', 'sa', 'Alice');
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.joinRoom(room.code, 'c', 'sc', 'Cara');
  manager.selectCharacter('sb', 'trainee');

  assert.throws(() => manager.kickLobbyPlayer('sb', 'c'), /Only the host/);
  assert.throws(() => manager.kickLobbyPlayer('sa', 'a'), /Use Leave lobby/);
  manager.kickLobbyPlayer('sa', 'b');
  assert.deepEqual(room.players.map((player) => player.id), ['a', 'c']);
  assert.equal(manager.getRoomForSocket('sb'), undefined);
  assert.throws(() => manager.joinRoom(room.code, 'b', 'sb', 'Bob'), /host removed you/);
  assert.throws(() => manager.rejoinRoom(room.code, 'b', 'sb'), /host removed you/);
  manager.selectCharacter('sc', 'trainee');
  manager.joinRoom(room.code, 'd', 'sd', 'Dan');
  assert.equal(new Set(room.players.map((player) => player.color)).size, 3);
});

test('leaving transfers the host, allows guests to rejoin, and closes an empty lobby', () => {
  const manager = new RoomManager();
  const room = manager.createRoom('a', 'sa', 'Alice');
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.leaveLobby('sb');
  assert.equal(manager.getRoomForSocket('sb'), undefined);
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.leaveLobby('sa');
  assert.equal(room.hostId, 'b');
  assert.equal(manager.getRoomForSocket('sa'), undefined);
  manager.leaveLobby('sb');
  assert.equal(manager.rooms.has(room.code), false);

  const accidentalLobby = manager.createRoom('a', 'sa', 'Alice');
  manager.leaveLobby('sa');
  assert.equal(manager.rooms.has(accidentalLobby.code), false);
});

test('kick and leave are limited to the lobby before the game starts', () => {
  const manager = new RoomManager();
  const room = manager.createRoom('a', 'sa', 'Alice');
  manager.joinRoom(room.code, 'b', 'sb', 'Bob');
  manager.selectCharacter('sa', 'first');
  manager.selectCharacter('sb', 'second');
  manager.startGame('sa');
  assert.throws(() => manager.kickLobbyPlayer('sa', 'b'), /game has started/);
  assert.throws(() => manager.leaveLobby('sb'), /game has started/);
  assert.equal(room.players.length, 2);
});
