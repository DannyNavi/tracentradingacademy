import { useEffect, useRef, useState } from 'react';
import type { RoomState } from '../lib/types';
import { buildingLevel, liquidationValue, MIN_BID_INCREASE, type Auction } from '../../shared/rules';
import { declareBankruptcy, resolveDebt, respondToAuction } from '../lib/socket';
import { Carats } from './Carats';
import { PropertyControls } from './PropertyControls';

function AuctionPanel({ room, selfId, auction }: { room: RoomState; selfId: string; auction: Auction }) {
  const [bid, setBid] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [target, setTarget] = useState(auction.buildTargets?.[selfId]?.[0] ?? auction.spaceId);
  const me = room.players.find((p) => p.id === selfId);
  const participating = auction.eligible.includes(selfId) && !auction.passed.includes(selfId);
  const highBidder = room.players.find((p) => p.id === auction.highBidderId);
  const minimumBid = auction.highBid + MIN_BID_INCREASE;
  const bidInput = bid ?? String(minimumBid);
  const bidAmount = Number(bidInput);
  async function respond(amount: number | null) {
    setBusy(true); setError('');
    try {
      const result = await respondToAuction(auction.id, amount, target);
      if (!result.ok) throw new Error(result.error);
      setBid(null);
    }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="economy-notice" aria-label="Auction">
    <h3>{auction.kind === 'property' ? 'Property auction' : `Last ${auction.kind} auction`}</h3>
    <p>{auction.kind === 'property' ? room.content.properties.find((s) => s.id === auction.spaceId)?.name : `Bid for the bank’s final ${auction.kind}.`}</p>
    <p>Highest bid: <Carats amount={auction.highBid} />{highBidder ? ` · ${highBidder.name}` : ' · No bids yet'}</p>
    {participating ? <form onSubmit={(event) => { event.preventDefault(); void respond(bidAmount); }}>
      {auction.kind !== 'property' && <label>Build on<select value={target} onChange={(event) => setTarget(Number(event.target.value))}>
        {auction.buildTargets?.[selfId]?.map((id) => <option key={id} value={id}>{room.content.properties.find((s) => s.id === id)?.name}</option>)}
      </select></label>}
      <p>Minimum bid: <Carats amount={minimumBid} /></p>
      <label>Your bid<input type="number" min={minimumBid} max={me?.money ?? 0} step={1} required value={bidInput} onChange={(event) => setBid(event.target.value)} /></label>
      <div className="trade-buttons"><button className="btn primary" disabled={busy || !Number.isSafeInteger(bidAmount) || bidAmount < minimumBid || bidAmount > (me?.money ?? 0)}>Place bid</button>
        <button className="btn ghost" type="button" disabled={busy || auction.highBidderId === selfId} onClick={() => void respond(null)}>Pass auction</button></div>
    </form> : <p className="muted">You are watching this auction.</p>}
    <p className="muted">Passing leaves this auction. It ends when every other bidder passes.</p>
    <p className="muted">Still bidding: {auction.eligible.filter((id) => !auction.passed.includes(id)).map((id) => room.players.find((p) => p.id === id)?.name).join(', ')}</p>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

function Portfolio({ room, selfId, onClose }: { room: RoomState; selfId: string; onClose: () => void }) {
  const properties = room.content.properties.filter((s) => room.ownership[s.id] === selfId);
  const [id, setId] = useState(properties[0]?.id ?? -1);
  const space = properties.find((s) => s.id === id) ?? properties[0];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog className="tile-details" ref={dialog} aria-label="Your properties" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="tile-details-body" style={{ borderTopColor: 'var(--accent)' }}><div className="tile-details-heading"><h2>Your properties</h2><button className="btn ghost" aria-label="Close properties" onClick={() => dialog.current?.close()}>✕</button></div>
      {space ? <><label>Choose a property<select value={space.id} onChange={(event) => setId(Number(event.target.value))}>
        {properties.map((p) => <option value={p.id} key={p.id}>{p.name}{room.mortgaged?.[p.id] ? ' · mortgaged' : buildingLevel(room, p.id) ? ` · ${buildingLevel(room, p.id) === 5 ? 'hotel' : `${buildingLevel(room, p.id)} house${buildingLevel(room, p.id) === 1 ? '' : 's'}`}` : ''}</option>)}
      </select></label><PropertyControls key={space.id} room={room} space={space} selfId={selfId} /></> : <p>No properties owned yet. Buy a property, win an auction, or make a trade.</p>}
    </div>
  </dialog>;
}

export function EconomyPanel({ room, selfId }: { room: RoomState; selfId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const me = room.players.find((p) => p.id === selfId);
  const canDeclare = room.phase === 'playing' && me && !me.bankrupt &&
    room.players[room.turnIndex]?.id === selfId && room.pending.type === 'none' &&
    !room.auction && !room.debts?.length;

  async function resign() {
    if (!window.confirm('Declare bankruptcy and leave the game? The bank will auction your properties.')) return;
    setBusy(true);
    setError('');
    try {
      const result = await declareBankruptcy();
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pay(id: string, bankrupt: boolean) {
    setBusy(true); setError('');
    try { const result = await resolveDebt(id, bankrupt); if (!result.ok) throw new Error(result.error); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <>
    {me && !me.bankrupt && <button className="btn ghost portfolio-button" aria-haspopup="dialog" onClick={() => setOpen(true)}>Manage properties</button>}
    {canDeclare && <button className="btn danger portfolio-button" disabled={busy} onClick={() => void resign()}>Declare bankruptcy</button>}
    {open && <Portfolio room={room} selfId={selfId} onClose={() => setOpen(false)} />}
    {room.auction && <AuctionPanel key={room.auction.id} room={room} selfId={selfId} auction={room.auction} />}
    {(room.debts ?? []).map((debt) => <section className="economy-notice" key={debt.id} aria-label="Outstanding debt">
      <h3>{debt.playerId === selfId ? 'Raise funds to continue' : `${room.players.find((p) => p.id === debt.playerId)?.name} owes a payment`}</h3>
      <p><Carats amount={debt.amount} /> to {room.players.find((p) => p.id === debt.toPlayerId)?.name ?? 'the bank'} · {debt.reason}</p>
      {debt.playerId === selfId && <><p>Sell buildings, mortgage properties, or trade to raise funds. Your available cash: <Carats amount={me?.money ?? 0} />.</p>
        <div className="trade-buttons"><button className="btn primary" disabled={busy || (me?.money ?? 0) < debt.amount} onClick={() => void pay(debt.id, false)}>Pay debt</button>
          <button className="btn ghost" disabled={busy || liquidationValue(room, selfId) >= debt.amount} onClick={() => void pay(debt.id, true)}>Declare bankruptcy</button></div>
        <p className="muted">Bankruptcy is available only when your cash and property liquidation value cannot cover this debt.</p></>}
    </section>)}
    {error && <p className="error" role="alert">{error}</p>}
    {room.startRolls?.length ? <details className="starting-rolls"><summary>Starting rolls</summary><ul>{room.startRolls.map((roll, i) => <li key={i}>{room.players.find((p) => p.id === roll.playerId)?.name}: {roll.dice.join(' + ')} = {roll.dice[0] + roll.dice[1]}</li>)}</ul></details> : null}
  </>;
}
