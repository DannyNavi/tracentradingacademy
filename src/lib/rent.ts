import type { BoardSpace, RoomState } from './types.js';

export function rentTerms(room: RoomState, space: BoardSpace) {
  const ownerId = room.ownership[space.id];
  const owned = room.content.properties.filter((other) =>
    other.kind === space.kind && ownerId && room.ownership[other.id] === ownerId).length;
  const group = space.group
    ? room.content.properties.filter((other) => other.kind === 'property' && other.group === space.group)
    : [];
  const completeGroup = Boolean(ownerId && group.length && group.every((other) => room.ownership[other.id] === ownerId));
  const multiplier = space.kind === 'utility' ? (owned >= 2 ? 10 : 4) : 1;
  const fixed = space.kind === 'rail' ? [0, 25, 50, 100, 200][Math.min(4, Math.max(1, owned))]
    : space.kind === 'property' ? (space.rent ?? 0) * (completeGroup ? 2 : 1) : 0;
  return { owned, group, completeGroup, multiplier, fixed };
}

export function calculateRent(room: RoomState, space: BoardSpace, diceTotal: number) {
  const terms = rentTerms(room, space);
  return space.kind === 'utility' ? diceTotal * terms.multiplier : terms.fixed;
}
