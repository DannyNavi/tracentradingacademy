import { useEffect, useId, useRef, useState } from 'react';
import type { Trade, TradeAssets, TradeProposal } from '../../shared/trades';
import type { PlayerPublic, RoomState } from '../lib/types';
import { proposeTrade, respondToTrade } from '../lib/socket';
import { Carats } from './Carats';
import { mortgageValue } from '../../shared/rules';

const emptyAssets = (): TradeAssets => ({ money: 0, propertyIds: [], freePasses: 0 });
const includesPlayer = (trade: Trade, id: string) => trade.playerAId === id || trade.playerBId === id;

function offerFor(trade: Trade, selfId: string) {
  const isA = trade.playerAId === selfId;
  return {
    toPlayerId: isA ? trade.playerBId : trade.playerAId,
    give: structuredClone(isA ? trade.giveA : trade.giveB),
    receive: structuredClone(isA ? trade.giveB : trade.giveA),
    tradeId: trade.id, revision: trade.revision,
  };
}

function AssetSummary({ room, assets }: { room: RoomState; assets: TradeAssets }) {
  const items = assets.propertyIds.map((id) => room.content.properties.find((space) => space.id === id));
  return <ul className="trade-assets">
    {assets.money > 0 && <li><Carats amount={assets.money} /> carats</li>}
    {items.map((space, index) => <li key={assets.propertyIds[index]}><span className="trade-property-color" style={{ background: space?.color ?? 'var(--accent)' }} />{space?.name ?? `Space ${assets.propertyIds[index]}`}{space && room.mortgaged?.[space.id] ? ` (mortgaged; ${Math.ceil(mortgageValue(space) / 10)} carats interest for recipient)` : ''}</li>)}
    {assets.freePasses > 0 && <li>{assets.freePasses} Infirmary free pass{assets.freePasses === 1 ? '' : 'es'}</li>}
    {!assets.money && !assets.propertyIds.length && !assets.freePasses && <li className="muted">Nothing</li>}
  </ul>;
}

function AssetPicker({ title, player, room, assets, onChange, disabled }: {
  title: string; player: PlayerPublic; room: RoomState; assets: TradeAssets;
  onChange: (assets: TradeAssets) => void; disabled: boolean;
}) {
  const properties = room.content.properties.filter((space) => room.ownership[space.id] === player.id);
  return <fieldset className="trade-side" disabled={disabled}>
    <legend>{title}</legend>
    <p className="muted">{player.name} · <Carats amount={player.money} /> available</p>
    <label>Carats<input type="number" min={0} max={player.money} step={1} required value={Number.isNaN(assets.money) ? '' : assets.money}
      onChange={(event) => onChange({ ...assets, money: event.target.valueAsNumber })} /></label>
    <label>Infirmary free passes ({player.getOutCards} available)<input type="number" min={0} max={player.getOutCards} step={1} required value={Number.isNaN(assets.freePasses) ? '' : assets.freePasses}
      onChange={(event) => onChange({ ...assets, freePasses: event.target.valueAsNumber })} /></label>
    <h3>Properties</h3>
    <div className="trade-property-list">
      {properties.length ? properties.map((space) => <label className="trade-property-option" key={space.id}>
        <input type="checkbox" checked={assets.propertyIds.includes(space.id)} onChange={(event) => onChange({
          ...assets, propertyIds: event.target.checked ? [...assets.propertyIds, space.id] : assets.propertyIds.filter((id) => id !== space.id),
        })} />
        <span className="trade-property-color" style={{ background: space.color ?? 'var(--accent)' }} />
        <span>{space.name}</span>
      </label>) : <p className="muted">No properties owned yet.</p>}
    </div>
  </fieldset>;
}

function TradeEditor({ room, selfId, initial, busy, onSubmit, onBack }: {
  room: RoomState; selfId: string; initial: TradeProposal; busy: boolean;
  onSubmit: (proposal: TradeProposal) => Promise<void>; onBack: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const me = room.players.find((player) => player.id === selfId)!;
  const other = room.players.find((player) => player.id === draft.toPlayerId);
  const partners = room.players.filter((player) => player.id !== selfId && !player.bankrupt);
  const original = room.trades?.find((trade) => trade.id === draft.tradeId);
  const stale = Boolean(draft.tradeId && (!original || original.status !== 'pending' || original.revision !== draft.revision));
  const blocked = room.phase !== 'playing' || Boolean(room.auction) || !['none', 'debt'].includes(room.pending.type);
  const empty = ![draft.give, draft.receive].some((assets) => assets.money || assets.propertyIds.length || assets.freePasses);
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit(draft); }}>
    <h3>{draft.tradeId ? 'Propose a counteroffer' : 'Make an offer'}</h3>
    <label>Trade with<select value={draft.toPlayerId} disabled={busy || Boolean(draft.tradeId)} required
      onChange={(event) => setDraft({ toPlayerId: event.target.value, give: emptyAssets(), receive: emptyAssets() })}>
      <option value="" disabled>Choose a player</option>
      {partners.map((player) => <option key={player.id} value={player.id} disabled={!player.connected}>{player.name}{player.connected ? '' : ' (offline)'}</option>)}
    </select></label>
    {other && <div className="trade-columns">
      <AssetPicker title="You give" player={me} room={room} assets={draft.give} disabled={busy}
        onChange={(give) => setDraft({ ...draft, give })} />
      <AssetPicker title="You receive" player={other} room={room} assets={draft.receive} disabled={busy}
        onChange={(receive) => setDraft({ ...draft, receive })} />
    </div>}
    <p className="muted">Sending a proposal does not approve it. Both players must agree to the same version. Counteroffers reset both approvals.</p>
    {blocked && <p role="status">Finish the current game action before sending an offer.</p>}
    {stale && <p role="alert">This offer changed or closed while you were editing. Go back and review its latest version.</p>}
    <div className="trade-buttons">
      <button className="btn primary" type="submit" disabled={busy || blocked || stale || empty || !other?.connected || other.bankrupt}>{busy ? 'Sending…' : draft.tradeId ? 'Send counteroffer' : 'Send offer'}</button>
      <button className="btn ghost" type="button" disabled={busy} onClick={onBack}>Back</button>
    </div>
  </form>;
}

function TradeDialog({ room, selfId, onClose }: { room: RoomState; selfId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const trades = (room.trades ?? []).filter((trade) => includesPlayer(trade, selfId));
  const [selectedId, setSelectedId] = useState<string | null>(() => trades.filter((trade) => trade.status === 'pending').at(-1)?.id ?? null);
  const [draft, setDraft] = useState<TradeProposal | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = trades.find((trade) => trade.id === selectedId);
  const terms = selected ? offerFor(selected, selfId) : null;
  const other = room.players.find((player) => player.id === terms?.toPlayerId);
  const nameOf = (id: string) => room.players.find((player) => player.id === id)?.name ?? 'Player';
  const blocked = !['none', 'debt'].includes(room.pending.type) || Boolean(room.auction) || room.phase !== 'playing';

  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);

  function newOffer() {
    setEditorVersion((version) => version + 1);
    setError('');
    setSelectedId(null);
    setDraft({ toPlayerId: room.players.find((player) => player.id !== selfId && !player.bankrupt && player.connected)?.id ?? '', give: emptyAssets(), receive: emptyAssets() });
  }

  async function send(proposal: TradeProposal) {
    setBusy(true); setError('');
    try {
      const result = await proposeTrade(proposal);
      if (!result.ok) throw new Error(result.error ?? 'Could not send the offer.');
      const sent = result.room?.trades?.find((trade) => proposal.tradeId ? trade.id === proposal.tradeId
        : trade.status === 'pending' && includesPlayer(trade, selfId) && includesPlayer(trade, proposal.toPlayerId));
      setSelectedId(sent?.id ?? null); setDraft(null);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function respond(action: 'agree' | 'decline') {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await respondToTrade({ tradeId: selected.id, revision: selected.revision, action });
      if (!result.ok) throw new Error(result.error ?? 'Could not respond to the offer.');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return <dialog className="tile-details trade-dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose}
    onClick={(event) => { if (event.currentTarget === event.target) dialog.current?.close(); }}>
    <div className="tile-details-body">
      <div className="tile-details-heading"><div><p className="eyebrow">Player exchange</p><h2 id={titleId}>Trading</h2></div>
        <button className="btn ghost" type="button" aria-label="Close trading" onClick={() => dialog.current?.close()}>✕</button>
      </div>
      <div className="trade-menu">
        <nav className="trade-offers" aria-label="Your trade offers">
          <button className="btn primary" type="button" disabled={busy || room.phase !== 'playing'} onClick={newOffer}>New offer</button>
          {[...trades].reverse().map((trade) => <button type="button" key={trade.id} disabled={busy}
            className={`trade-offer-link ${selectedId === trade.id && !draft ? 'selected' : ''}`}
            aria-current={selectedId === trade.id && !draft ? 'true' : undefined}
            onClick={() => { setSelectedId(trade.id); setDraft(null); setError(''); }}>
            <strong>{nameOf(trade.playerAId === selfId ? trade.playerBId : trade.playerAId)}</strong>
            <span>{trade.status === 'pending' ? trade.approvedBy.includes(selfId) ? 'Waiting for agreement' : 'Review offer' : trade.status}</span>
            <small>Version {trade.revision} · {nameOf(trade.proposedBy)}’s proposal</small>
          </button>)}
          {!trades.length && <p className="muted">Your offers will appear here.</p>}
        </nav>
        <div className="trade-content">
          {error && <p className="error" role="alert">{error}</p>}
          {draft ? <TradeEditor key={editorVersion} room={room} selfId={selfId} initial={draft} busy={busy} onSubmit={send} onBack={() => { setDraft(null); setError(''); }} />
            : selected && terms ? <>
              <p className="eyebrow">Version {selected.revision} · {nameOf(selected.proposedBy)}’s proposal</p>
              <h3>Trade with {other?.name}</h3>
              <div className="trade-columns">
                <section className="trade-side"><h3>You give</h3><AssetSummary room={room} assets={terms.give} /></section>
                <section className="trade-side"><h3>You receive</h3><AssetSummary room={room} assets={terms.receive} /></section>
              </div>
              <div className="trade-approvals" role="status">
                {[selfId, terms.toPlayerId].map((id) => <p key={id}>{id === selfId ? 'You' : nameOf(id)}: {selected.status === 'completed' || selected.approvedBy.includes(id) ? 'Agreed' : 'Not yet agreed'}</p>)}
              </div>
              {selected.status === 'pending' ? <>
                <p className="muted">The trade completes only when both players agree. A counteroffer clears both approvals.</p>
                {blocked && <p role="status">Finish the current game action before agreeing or countering.</p>}
                {!other?.connected && <p role="status">Waiting for {other?.name} to reconnect.</p>}
                <div className="trade-buttons">
                  <button className="btn primary" disabled={busy || blocked || !other?.connected || selected.approvedBy.includes(selfId)} onClick={() => void respond('agree')}>
                    {selected.approvedBy.includes(selfId) ? 'You agreed' : 'Agree to this offer'}
                  </button>
                  <button className="btn ghost" disabled={busy || blocked || !other?.connected} onClick={() => { setEditorVersion((version) => version + 1); setDraft(terms); setError(''); }}>Propose counteroffer</button>
                  <button className="btn ghost" disabled={busy} onClick={() => void respond('decline')}>{selected.proposedBy === selfId ? 'Withdraw offer' : 'Refuse offer'}</button>
                </div>
              </> : <p className="trade-result" role="status">{selected.status === 'completed' ? 'Trade completed! The agreed assets have been exchanged.'
                : selected.status === 'invalidated' ? `Offer closed: ${selected.reason}`
                : selected.status === 'declined' ? 'This offer was refused.' : 'This offer was withdrawn.'}</p>}
            </> : <div className="trade-empty"><h3>Make a deal</h3><p>Offer carats, properties, or Infirmary free passes to another player. They can refuse, agree, or send a counteroffer.</p>
              <button className="btn primary" onClick={newOffer} disabled={room.phase !== 'playing'}>Create an offer</button></div>}
        </div>
      </div>
    </div>
  </dialog>;
}

export function TradingPanel({ room, selfId }: { room: RoomState; selfId: string }) {
  const [open, setOpen] = useState(false);
  const player = room.players.find((p) => p.id === selfId);
  const waiting = (room.trades ?? []).filter((trade) => trade.status === 'pending' && includesPlayer(trade, selfId) && !trade.approvedBy.includes(selfId));
  if (!player || player.bankrupt) return null;
  return <div className="trading-entry">
    <button className="btn ghost trade-open" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      Trade with players{waiting.length > 0 && <span className="trade-count">{waiting.length} to review</span>}
    </button>
    {waiting.some((trade) => trade.proposedBy !== selfId) && <p role="status" className="trade-incoming">You have a trade offer to review.</p>}
    {open && <TradeDialog room={room} selfId={selfId} onClose={() => setOpen(false)} />}
  </div>;
}
