import type { Auction, Debt, DebtResume, Deck, HeldCard } from '../shared/rules.js';
import type { Trade } from '../shared/trades.js';

export type CardEffect =
  | { type: 'money'; amount: number }
  | { type: 'move'; position: number }
  | { type: 'move_relative'; steps: number }
  | { type: 'jail' }
  | { type: 'nearest_rail' }
  | { type: 'nearest_utility' }
  | { type: 'pay_each'; amount: number }
  | { type: 'collect_each'; amount: number }
  | { type: 'repairs'; house: number; hotel: number }
  | { type: 'get_out_of_jail' };

export type GameCard = {
  id: string;
  text: string;
  effect: CardEffect;
};

export type SpaceKind =
  | 'go'
  | 'property'
  | 'rail'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community'
  | 'jail'
  | 'free'
  | 'gotojail';

export type BoardSpace = {
  id: number;
  kind: SpaceKind;
  name: string;
  price?: number;
  rent?: number;
  group?: string;
  color?: string;
  taxAmount?: number;
  buildingCost?: number;
  mortgageValue?: number;
  rentLevels?: number[];
};

export type GameContent = {
  properties: BoardSpace[];
  chance: GameCard[];
  community: GameCard[];
};

export type PlayerPublic = {
  movements?: { id: number; path: number[] }[];
  id: string;
  name: string;
  color: string;
  characterId: string | null;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutCards: number;
  bankrupt: boolean;
  connected: boolean;
};

export type GamePhase =
  | 'lobby'
  | 'config'
  | 'starting'
  | 'playing'
  | 'finished';

export type PendingAction =
  | { type: 'none' }
  | { type: 'buy_or_pass'; spaceId: number; price: number }
  | { type: 'pay_rent'; toPlayerId: string; amount: number; spaceId: number }
  | { type: 'pay_tax'; amount: number }
  | { type: 'card'; deck: 'chance' | 'community'; card: GameCard }
  | { type: 'jail_choice' }
  | { type: 'debt' };

export type RoomState = {
  buildings?: Record<number, number>;
  mortgaged?: Record<number, boolean>;
  auction?: Auction | null;
  auctionQueue?: number[];
  auctionResumeCanRoll?: boolean;
  debts?: Debt[];
  debtResume?: DebtResume;
  extraRollEligible?: boolean;
  startingRound?: { number: number; eligibleIds: string[]; rolls: Record<string, [number, number]> };
  startRolls?: { playerId: string; dice: [number, number]; round?: number }[];
  cardDecks?: Record<Deck, string[]>;
  heldCards?: Record<string, HeldCard[]>;
  trades?: Trade[];
  code: string;
  hostId: string;
  phase: GamePhase;
  content: GameContent;
  players: PlayerPublic[];
  turnIndex: number;
  ownership: Record<number, string>; // spaceId -> playerId
  lastDice: [number, number] | null;
  lastRollId?: number;
  doublesCount: number;
  log: string[];
  pending: PendingAction;
  winnerId: string | null;
  canRoll: boolean;
};
