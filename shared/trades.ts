export type TradeAssets = {
  money: number;
  propertyIds: number[];
  freePasses: number;
};

export type Trade = {
  id: string;
  playerAId: string;
  playerBId: string;
  giveA: TradeAssets;
  giveB: TradeAssets;
  proposedBy: string;
  revision: number;
  approvedBy: string[];
  status: 'pending' | 'completed' | 'declined' | 'cancelled' | 'invalidated';
  reason?: string;
};

export type TradeProposal = {
  toPlayerId: string;
  give: TradeAssets;
  receive: TradeAssets;
  tradeId?: string;
  revision?: number;
};

export type TradeResponse = {
  tradeId: string;
  revision: number;
  action: 'agree' | 'decline';
};
