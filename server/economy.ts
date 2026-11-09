import { randomUUID } from 'node:crypto';
import { bankSupply, buildingCost, buildingLevel, buildProblem, liquidationValue, mortgageValue, propertyGroup, type PropertyAction } from '../shared/rules.js';
import type { PlayerPublic, RoomState } from './types.js';
import { movePasses } from './cards.js';

export function logEconomy(room: RoomState, message: string) { room.log = [message, ...room.log].slice(0, 40); }
export function livingPlayer(room: RoomState, id: string) {
  const player = room.players.find((p) => p.id === id && !p.bankrupt);
  if (!player || room.phase !== 'playing') throw new Error('Player is not active in this game.');
  return player;
}

export function charge(room: RoomState, player: PlayerPublic, amount: number, toPlayerId: string | null, reason: string) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid payment amount.');
  if (player.money >= amount) {
    player.money -= amount;
    const recipient = room.players.find((p) => p.id === toPlayerId && !p.bankrupt);
    if (recipient) recipient.money += amount;
    logEconomy(room, `${player.name} paid ${amount} carats${recipient ? ` to ${recipient.name}` : ' to the bank'}: ${reason}.`);
    return true;
  }
  room.debts ??= [];
  room.debts.push({ id: randomUUID(), playerId: player.id, toPlayerId, amount, reason });
  room.pending = { type: 'debt' };
  room.canRoll = false;
  room.debtResume ??= { kind: 'after_action' };
  logEconomy(room, `${player.name} must raise ${amount - player.money} more carats for ${reason}.`);
  return false;
}

export function startPropertyAuction(room: RoomState, spaceId: number) {
  room.auction = { id: randomUUID(), kind: 'property', spaceId, eligible: room.players.filter((p) => !p.bankrupt && p.connected).map((p) => p.id), passed: [], highBid: 0, highBidderId: null };
  room.canRoll = false;
  logEconomy(room, `Auction opened for ${room.content.properties.find((s) => s.id === spaceId)?.name}.`);
}

export function auctionAction(room: RoomState, playerId: string, id: string, amount: number | null, targetId?: number) {
  const player = livingPlayer(room, playerId);
  const auction = room.auction;
  if (!auction || auction.id !== id) throw new Error('This auction has ended.');
  if (!auction.eligible.includes(playerId) || auction.passed.includes(playerId)) throw new Error('You are not bidding in this auction.');
  if (amount === null) {
    if (auction.highBidderId === playerId) throw new Error('The highest bidder cannot withdraw their bid.');
    auction.passed.push(playerId);
  } else {
    if (!Number.isSafeInteger(amount) || amount <= auction.highBid || amount > player.money) throw new Error('Bid a whole amount above the current bid that you can afford.');
    if (auction.kind !== 'property' && !auction.buildTargets?.[playerId]?.includes(targetId!)) throw new Error('Choose one of your eligible properties for this building.');
    auction.highBid = amount; auction.highBidderId = playerId; auction.winnerTarget = targetId;
    logEconomy(room, `${player.name} bid ${amount} carats.`);
  }
  const remaining = auction.eligible.filter((id) => !auction.passed.includes(id));
  if (auction.highBidderId ? remaining.every((id) => id === auction.highBidderId) : remaining.length === 0) {
    if (auction.highBidderId) {
      const winner = livingPlayer(room, auction.highBidderId);
      winner.money -= auction.highBid;
      if (auction.kind === 'property') room.ownership[auction.spaceId] = winner.id;
      else {
        room.buildings ??= {};
        room.buildings[auction.winnerTarget!] = buildingLevel(room, auction.winnerTarget!) + 1;
      }
      logEconomy(room, `${winner.name} won the ${auction.kind} auction for ${auction.highBid} carats.`);
    } else logEconomy(room, 'Auction closed without a bid.');
    room.auction = null;
  }
}

export function manageProperty(room: RoomState, playerId: string, spaceId: number, action: PropertyAction) {
  const player = livingPlayer(room, playerId);
  const space = room.content.properties.find((s) => s.id === spaceId);
  if (!space || !['property', 'rail', 'utility'].includes(space.kind) || room.ownership[spaceId] !== playerId) throw new Error('You do not own this property.');
  if (!['build', 'sell', 'sell_group', 'mortgage', 'unmortgage'].includes(action)) throw new Error('Unknown property action.');
  room.buildings ??= {}; room.mortgaged ??= {};
  const group = propertyGroup(room, space);
  const level = buildingLevel(room, spaceId);
  if (room.auction?.kind !== 'property' && room.auction) throw new Error('Finish the building auction first.');
  if (action === 'build' || action === 'unmortgage') {
    if (room.pending.type !== 'none' || room.auction || room.debts?.length) throw new Error('Resolve the current game action before spending on property.');
  }
  if (action === 'build') {
    const problem = buildProblem(room, playerId, space);
    if (problem) throw new Error(problem);
    if (player.money < buildingCost(space)) throw new Error('Not enough carats to build.');
    const kind = level === 4 ? 'hotel' : 'house';
    if ((kind === 'house' ? bankSupply(room).houses : bankSupply(room).hotels) === 1) {
      const targets: Record<string, number[]> = {};
      for (const bidder of room.players.filter((p) => !p.bankrupt && p.connected)) {
        const eligible = room.content.properties.filter((s) => !buildProblem(room, bidder.id, s) && (buildingLevel(room, s.id) === 4) === (kind === 'hotel'));
        if (eligible.length) targets[bidder.id] = eligible.map((s) => s.id);
      }
      if (Object.keys(targets).length > 1) {
        room.auctionResumeCanRoll = room.canRoll;
        room.auction = { id: randomUUID(), kind, spaceId, eligible: Object.keys(targets), passed: [], highBid: 0, highBidderId: null, buildTargets: targets };
        logEconomy(room, `The last available ${kind} is being auctioned.`);
        return;
      }
    }
    player.money -= buildingCost(space); room.buildings[spaceId] = level + 1;
  } else if (action === 'sell') {
    if (!level || group.some((s) => buildingLevel(room, s.id) > level)) throw new Error('Sell buildings evenly, starting with the most developed properties.');
    if (level === 5 && bankSupply(room).houses < 4) throw new Error('The bank needs four houses to replace this hotel. Sell all buildings in this group instead.');
    room.buildings[spaceId] = level - 1; player.money += Math.floor(buildingCost(space) / 2);
  } else if (action === 'sell_group') {
    if (!group.some((s) => buildingLevel(room, s.id))) throw new Error('This group has no buildings.');
    if (group.some((s) => room.ownership[s.id] !== playerId)) throw new Error('You must own the whole group.');
    for (const member of group) { player.money += buildingLevel(room, member.id) * Math.floor(buildingCost(member) / 2); room.buildings[member.id] = 0; }
  } else if (action === 'mortgage') {
    if (room.mortgaged[spaceId]) throw new Error('This property is already mortgaged.');
    if (group.some((s) => buildingLevel(room, s.id))) throw new Error('Sell all buildings in this group before mortgaging.');
    room.mortgaged[spaceId] = true; player.money += mortgageValue(space);
  } else {
    if (!room.mortgaged[spaceId]) throw new Error('This property is not mortgaged.');
    const cost = mortgageValue(space) + Math.ceil(mortgageValue(space) / 10);
    if (player.money < cost) throw new Error('Not enough carats to repay the mortgage plus 10% interest.');
    player.money -= cost; delete room.mortgaged[spaceId];
  }
  logEconomy(room, `${player.name}: ${action.replaceAll('_', ' ')} at ${space.name}.`);
}

export function settleDebt(room: RoomState, playerId: string, debtId: string, bankrupt: boolean) {
  const player = livingPlayer(room, playerId);
  const debt = room.debts?.find((d) => d.id === debtId && d.playerId === playerId);
  if (!debt) throw new Error('This debt is no longer outstanding.');
  if (!bankrupt) {
    if (player.money < debt.amount) throw new Error('Raise funds by selling buildings, mortgaging, or trading first.');
    player.money -= debt.amount;
    const recipient = room.players.find((p) => p.id === debt.toPlayerId && !p.bankrupt);
    if (recipient) recipient.money += debt.amount;
    logEconomy(room, `${player.name} settled ${debt.amount} carats for ${debt.reason}.`);
    room.debts = room.debts!.filter((d) => d.id !== debtId);
    return;
  }
  if (liquidationValue(room, playerId) >= debt.amount) throw new Error('Your assets can cover this debt. Sell buildings or mortgage property first.');
  const creditor = room.players.find((p) => p.id === debt.toPlayerId && !p.bankrupt);
  let interest = 0;
  for (const space of room.content.properties.filter((s) => room.ownership[s.id] === playerId)) {
    player.money += buildingLevel(room, space.id) * Math.floor(buildingCost(space) / 2);
    if (room.buildings) delete room.buildings[space.id];
    if (creditor) {
      room.ownership[space.id] = creditor.id;
      if (room.mortgaged?.[space.id]) interest += Math.ceil(mortgageValue(space) / 10);
    } else {
      delete room.ownership[space.id];
      if (room.mortgaged) delete room.mortgaged[space.id];
      room.auctionQueue ??= []; room.auctionQueue.push(space.id);
    }
  }
  if (creditor) { creditor.money += player.money; creditor.getOutCards += player.getOutCards; }
  movePasses(room, playerId, creditor?.id ?? null, player.getOutCards);
  player.money = 0; player.getOutCards = 0; player.bankrupt = true;
  room.debts = room.debts!.filter((d) => d.playerId !== playerId).map((d) => d.toPlayerId === playerId ? { ...d, toPlayerId: creditor?.id ?? null } : d);
  logEconomy(room, `${player.name} declared bankruptcy${creditor ? `; assets transferred to ${creditor.name}` : '; properties returned to the bank for auction'}.`);
  if (creditor && interest) charge(room, creditor, interest, null, 'interest on inherited mortgages');
}
