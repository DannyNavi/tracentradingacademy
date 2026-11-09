import type { Deck } from '../shared/rules.js';
import type { GameCard, RoomState } from './types.js';

export function initializeDecks(room: RoomState) {
  room.cardDecks = { chance: [], community: [] };
  for (const deck of ['chance', 'community'] as const) {
    const held = new Set(Object.values(room.heldCards ?? {}).flat().filter((c) => c.deck === deck).map((c) => c.id));
    const ids = room.content[deck].map((card) => card.id).filter((id) => !held.has(id));
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    room.cardDecks[deck] = ids;
  }
}

export function drawFromDeck(room: RoomState, deck: Deck): GameCard {
  if (!room.cardDecks) initializeDecks(room);
  const id = room.cardDecks![deck].shift();
  const card = room.content[deck].find((c) => c.id === id);
  if (!card) throw new Error('This card deck has no available cards.');
  return card;
}

export function returnCard(room: RoomState, deck: Deck, id: string) {
  if (!room.cardDecks) initializeDecks(room);
  if (!room.cardDecks![deck].includes(id)) room.cardDecks![deck].push(id);
}

export function movePasses(room: RoomState, fromId: string, toId: string | null, count: number) {
  const held = room.heldCards?.[fromId] ?? [];
  const moved = held.splice(0, count);
  if (toId) {
    room.heldCards ??= {};
    room.heldCards[toId] = [...(room.heldCards[toId] ?? []), ...moved];
  } else moved.forEach((card) => returnCard(room, card.deck, card.id));
}
