import type { BoardSpace, PlayerPublic, RoomState } from '../src/lib/types.js';

export type Deck = 'chance' | 'community';
export type HeldCard = { deck: Deck; id: string };
export type Debt = { id: string; playerId: string; toPlayerId: string | null; amount: number; reason: string };
export const MIN_BID_INCREASE = 10;
export type Auction = {
  id: string; kind: 'property' | 'house' | 'hotel'; spaceId: number;
  eligible: string[]; passed: string[]; highBid: number; highBidderId: string | null;
  buildTargets?: Record<string, number[]>; winnerTarget?: number;
};
export type PropertyAction = 'build' | 'sell' | 'sell_group' | 'mortgage' | 'unmortgage';
export type DebtResume = { kind: 'after_action' } | { kind: 'jail_exit' } | { kind: 'jail_roll'; steps: number };

export const buildingLevel = (room: RoomState, id: number) => room.buildings?.[id] ?? 0;
export const mortgageValue = (space: BoardSpace) => space.mortgageValue ?? Math.floor((space.price ?? 0) / 2);
export const buildingCost = (space: BoardSpace) => space.buildingCost ?? (Math.floor(space.id / 10) + 1) * 50;
export const rentLevels = (space: BoardSpace) => space.rentLevels ?? [5, 15, 45, 80, 125].map((factor) => (space.rent ?? 0) * factor);
export const propertyGroup = (room: RoomState, space: BoardSpace) => space.group
  ? room.content.properties.filter((s) => s.kind === 'property' && s.group === space.group) : [space];
export const bankSupply = (room: RoomState) => {
  const levels = Object.values(room.buildings ?? {});
  return { houses: 32 - levels.reduce((sum, n) => sum + (n < 5 ? n : 0), 0), hotels: 12 - levels.filter((n) => n === 5).length };
};
export function buildProblem(room: RoomState, ownerId: string, space: BoardSpace): string | null {
  if (space.kind !== 'property' || !space.group) return 'Only grouped properties can be developed.';
  const group = propertyGroup(room, space);
  if (group.some((s) => room.ownership[s.id] !== ownerId)) return 'Own the complete group before building.';
  if (group.some((s) => room.mortgaged?.[s.id])) return 'Repay all mortgages in this group first.';
  const level = buildingLevel(room, space.id);
  if (level >= 5) return 'This property already has a hotel.';
  if (group.some((s) => buildingLevel(room, s.id) < level)) return 'Build evenly across the group.';
  if (level === 4 ? bankSupply(room).hotels < 1 : bankSupply(room).houses < 1) return 'The bank has no buildings of this type available.';
  return null;
}
export function caratGain(player: PlayerPublic, amount: number) {
  const percent = player.caratBonuses?.reduce((highest, bonus) =>
    bonus.startsNextTurn ? highest : Math.max(highest, bonus.amount), 0) ?? 0;
  return amount + Math.floor(amount * percent / 100);
}

export function liquidationValue(room: RoomState, playerId: string) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return 0;
  return room.content.properties.reduce((sum, space) => room.ownership[space.id] !== playerId ? sum
    : sum + caratGain(player, buildingLevel(room, space.id) * Math.floor(buildingCost(space) / 2)) +
      (room.mortgaged?.[space.id] ? 0 : caratGain(player, mortgageValue(space))), player.money);
}
