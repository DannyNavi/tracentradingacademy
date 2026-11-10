import { useState } from 'react';
import { bankSupply, buildingCost, buildingLevel, buildProblem, mortgageValue, propertyGroup, type PropertyAction } from '../../shared/rules';
import type { BoardSpace, RoomState } from '../lib/types';
import { manageProperty } from '../lib/socket';
import { Carats } from './Carats';

export function PropertyControls({ room, space, selfId }: { room: RoomState; space: BoardSpace; selfId?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const me = room.players.find((p) => p.id === selfId);
  if (!me || me.bankrupt || room.phase !== 'playing' || room.ownership[space.id] !== selfId) return null;
  const level = buildingLevel(room, space.id), group = propertyGroup(room, space);
  const hasBuildings = group.some((s) => buildingLevel(room, s.id));
  const mortgaged = room.mortgaged?.[space.id];
  const isMyTurn = room.players[room.turnIndex]?.id === me.id;
  const canSpend = !room.auction && !room.debts?.length && room.pending.type === 'none';
  const buildingAuction = Boolean(room.auction && room.auction.kind !== 'property');
  const buildError = buildProblem(room, me.id, space);
  const repay = mortgageValue(space) + Math.ceil(mortgageValue(space) / 10);
  async function act(action: PropertyAction) {
    setBusy(true); setError('');
    try { const result = await manageProperty(space.id, action); if (!result.ok) throw new Error(result.error); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="property-controls">
    <h3>Manage your property</h3>
    {space.kind === 'property' && <>
      <p>Development: {level === 5 ? 'Hotel' : `${level} house${level === 1 ? '' : 's'}`}. Bank: {bankSupply(room).houses} houses, {bankSupply(room).hotels} hotels.</p>
      <div className="trade-buttons">
        <button className="btn primary" disabled={busy || !canSpend || Boolean(buildError) || me.money < buildingCost(space)} onClick={() => void act('build')}>
          {level === 5 ? 'Hotel built' : level === 4 ? 'Build hotel' : 'Build house'} · <Carats amount={buildingCost(space)} />
        </button>
        <button className="btn ghost" disabled={busy || buildingAuction || !level || group.some((s) => buildingLevel(room, s.id) > level) || (level === 5 && bankSupply(room).houses < 4)} onClick={() => void act('sell')}>Sell one building · <Carats amount={Math.floor(buildingCost(space) / 2)} /></button>
        {hasBuildings && <button className="btn ghost" disabled={busy || buildingAuction} onClick={() => void act('sell_group')}>Sell all buildings in group</button>}
      </div>
      {buildError && level < 5 && <p className="muted">{buildError}</p>}
    </>}
    <div className="trade-buttons">
      {mortgaged ? <button className="btn primary" disabled={busy || !isMyTurn || !canSpend || me.money < repay} onClick={() => void act('unmortgage')}>Repay mortgage · <Carats amount={repay} /></button>
        : <button className="btn ghost" disabled={busy || buildingAuction || Boolean(hasBuildings)} onClick={() => void act('mortgage')}>Mortgage · receive <Carats amount={mortgageValue(space)} /></button>}
    </div>
    {mortgaged && !isMyTurn && <p className="muted">You can repay this mortgage on your turn.</p>}
    <p className="muted">Mortgaged properties collect no rent. Repayment includes 10% interest. Sell buildings evenly for half their purchase cost.</p>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
