export type CardEffect =
  | { type: 'money'; amount: number }
  | { type: 'move'; position: number }
  | { type: 'move_relative'; steps: number }
  | { type: 'jail' }
  | { type: 'nearest_rail' }
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
};

export type GameContent = {
  properties: BoardSpace[];
  chance: GameCard[];
  community: GameCard[];
};

export type PlayerPublic = {
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

export type GamePhase = 'lobby' | 'config' | 'playing' | 'finished';

export type PendingAction =
  | { type: 'none' }
  | { type: 'buy_or_pass'; spaceId: number; price: number }
  | { type: 'pay_rent'; toPlayerId: string; amount: number; spaceId: number }
  | { type: 'pay_tax'; amount: number }
  | { type: 'card'; deck: 'chance' | 'community'; card: GameCard }
  | { type: 'jail_choice' };

export type RoomState = {
  code: string;
  hostId: string;
  phase: GamePhase;
  content: GameContent;
  players: PlayerPublic[];
  turnIndex: number;
  ownership: Record<number, string>;
  lastDice: [number, number] | null;
  doublesCount: number;
  log: string[];
  pending: PendingAction;
  winnerId: string | null;
  canRoll: boolean;
};
