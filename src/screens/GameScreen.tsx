import { useState } from 'react';
import { Board } from '../components/Board';
import { Carats } from '../components/Carats';
import { TradingPanel } from '../components/TradingPanel';
import { EconomyPanel } from '../components/EconomyPanel';
import { getCharacter } from '../lib/characters';
import {
  buyProperty,
  endTurn,
  jailAction,
  passProperty,
  payDue,
  resolveCard,
  rollDice,
} from '../lib/socket';
import type { RoomState } from '../lib/types';

type Props = {
  room: RoomState;
  selfId: string;
};

function WagerForm({ money, onWager }: { money: number; onWager: (amount: number) => Promise<void> }) {
  const [wager, setWager] = useState(String(Math.min(100, money)));
  const [busy, setBusy] = useState(false);
  const amount = Number(wager);

  return (
    <form className="action-stack" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      try { await onWager(amount); } finally { setBusy(false); }
    }}>
      <label>
        Your wager
        <input type="number" min={0} max={money} step={1} required value={wager} onChange={(event) => setWager(event.target.value)} />
      </label>
      <p className="muted">Available <Carats amount={money} />. Wager 0 to sit this one out.</p>
      <button className="btn primary" disabled={busy || wager === '' || !Number.isSafeInteger(amount) || amount < 0 || amount > money}>
        {busy ? 'Rolling…' : 'Confirm wager and roll'}
      </button>
    </form>
  );
}

export function GameScreen({ room, selfId }: Props) {
  const me = room.players.find((p) => p.id === selfId);
  const current = room.players[room.turnIndex];
  const isMyTurn = current?.id === selfId;
  const pendingSpaceId = 'spaceId' in room.pending ? room.pending.spaceId : null;
  const pendingSpace = room.content.properties.find((space) => space.id === pendingSpaceId);
  const rentOwnerId = room.pending.type === 'pay_rent' ? room.pending.toPlayerId : null;
  const rentOwner = room.players.find((player) => player.id === rentOwnerId);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    try {
      const res = await fn();
      if (!res.ok) setError(res.error || 'Action failed');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const winner = room.winnerId
    ? room.players.find((p) => p.id === room.winnerId)
    : null;
  const winnerCharacter = getCharacter(winner?.characterId ?? null);

  const canRollOnBoard =
    !room.auction && !room.debts?.length &&
    room.phase === 'playing' &&
    isMyTurn &&
    room.pending.type === 'none' &&
    room.canRoll &&
    !me?.inJail;
  const choosingDie = canRollOnBoard && me?.dieChoice === 'ready';
  const pendingCard = room.pending.type === 'card' ? room.pending : null;
  const cardNeedsD20 = pendingCard?.card.d20Below !== undefined || pendingCard?.card.effect.type === 'sports_bet';
  const canEndTurn = room.phase === 'playing' && isMyTurn && !me?.bankrupt &&
    !room.auction && !room.debts?.length && room.pending.type === 'none' && !room.canRoll;
  const lastD20 = room.lastD20Roll;
  const lastD20Player = room.players.find((player) => player.id === lastD20?.playerId);

  return (
    <div className="game-page">
      <aside className="sidebar">
        <p className="brand-sm">Tracen Trading Academy</p>
        <h2 className="turn-line">
          {room.phase === 'finished'
            ? `${winner?.name ?? 'Someone'} wins!`
            : room.auction && current?.bankrupt
              ? 'Bankruptcy auction'
              : isMyTurn
                ? 'Your turn'
                : `${current?.name}'s turn`}
        </h2>

        <ul className="scoreboard">
          {room.players.map((p) => {
            const chara = getCharacter(p.characterId);
            return (
              <li
                key={p.id}
                className={`${p.id === current?.id ? 'active' : ''} ${p.bankrupt ? 'out' : ''}`}
              >
                {chara ? (
                  <img className="player-chara" src={chara.image} alt={chara.name} />
                ) : (
                  <span className="dot" style={{ background: p.color }} />
                )}
                <div>
                  <strong>
                    {p.name}
                    {p.id === selfId ? ' (you)' : ''}
                  </strong>
                  <div className="muted">
                    {chara ? `${chara.name} · ` : ''}
                    {p.bankrupt ? 'Out' : <Carats amount={p.money} />}
                    {p.inJail ? ' · Infirmary' : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <TradingPanel room={room} selfId={selfId} />
        <EconomyPanel room={room} selfId={selfId} />
        <div className="actions">
          {choosingDie && (
            <div className="action-stack" role="group" aria-label="Choose one die face">
              <p>Maruzensky’s ride. Pick one die face and roll the other die.</p>
              {[1, 2, 3, 4, 5, 6].map((face) => (
                <button key={face} className="btn primary" onClick={() => void run(() => rollDice(face))}>
                  Pick {face} and roll
                </button>
              ))}
            </div>
          )}
          {isMyTurn && room.pending.type === 'buy_or_pass' && (
            <div className="action-stack">
              <p>
                Buy {pendingSpace?.name} for{' '}
                <Carats amount={room.pending.price} />?
              </p>
              <button className="btn primary" onClick={() => void run(buyProperty)}>
                Buy
              </button>
              <button className="btn ghost" onClick={() => void run(passProperty)}>
                Pass · start auction
              </button>
            </div>
          )}

          {isMyTurn && room.pending.type === 'pay_rent' && (
            <div className="action-stack">
              <p>
                Pay <Carats amount={room.pending.amount} /> rent to {rentOwner?.name} for {pendingSpace?.name}.
              </p>
              <button className="btn primary" onClick={() => void run(payDue)}>
                Pay rent
              </button>
            </div>
          )}

          {isMyTurn && room.pending.type === 'pay_tax' && (
            <div className="action-stack">
              <p>
                Pay <Carats amount={room.pending.amount} /> fee
              </p>
              <button className="btn primary" onClick={() => void run(payDue)}>
                Pay
              </button>
            </div>
          )}

          {!cardNeedsD20 && lastD20 && (
            <div className="action-stack economy-notice" role="status">
              <p><strong>Last card d20 result: {lastD20.value}</strong></p>
              <p>{lastD20Player?.name ?? 'Player'} rolled. {lastD20.wager !== undefined
                ? <>Wager <Carats amount={lastD20.wager} /> · Payout <Carats amount={lastD20.payout ?? 0} /></>
                : lastD20.penaltyApplies ? 'Penalty applied.' : 'No penalty.'}</p>
            </div>
          )}

          {isMyTurn &&
            me?.inJail &&
            !me.bankrupt &&
            (room.pending.type === 'jail_choice' ||
              room.pending.type === 'none') &&
            (room.canRoll || room.pending.type === 'jail_choice') && (
              <div className="action-stack">
                <p>Infirmary — choose an exit</p>
                <button className="btn primary" onClick={() => void run(() => jailAction('roll'))}>
                  Roll for doubles
                </button>
                <button className="btn ghost" onClick={() => void run(() => jailAction('pay'))}>
                  Pay <Carats amount={50} />
                </button>
                <button
                  className="btn ghost"
                  disabled={!me || me.getOutCards < 1}
                  onClick={() => void run(() => jailAction('card'))}
                >
                  Use free pass ({me?.getOutCards ?? 0})
                </button>
              </div>
            )}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="log">
          <h3>Event log</h3>
          <ul>
            {room.log.map((line, i) => (
              <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="board-wrap">
        <Board
          room={room}
          selfId={selfId}
          canRoll={canRollOnBoard && !choosingDie}
          diceIdleMessage={choosingDie ? 'Choose a die face' : isMyTurn ? 'Roll when ready' : current ? `${current.name}'s turn` : 'Waiting for turn'}
          onRoll={() => void run(() => rollDice())}
          centerActions={
            room.phase === 'finished' && winner ? (
              <section className="board-victory" role="status">
                <p className="eyebrow">Victory</p>
                {winnerCharacter && <img src={winnerCharacter.image} alt={winnerCharacter.name} />}
                <h2>{winner.name} wins!</h2>
              </section>
            ) : <>
              {pendingCard && (
                <section className="action-stack card-reveal board-event" key={pendingCard.card.id} aria-label="Event card">
                  {pendingCard.deck === 'chance' && <img className="fuji-card-art" src="/fuji-hat.png" alt="" />}
                  <p className="eyebrow">{pendingCard.deck === 'chance' ? "Fuji's Hat" : 'Raffle Ticket'}</p>
                  <p role="status">{pendingCard.card.text}</p>
                  {isMyTurn ? pendingCard.card.effect.type === 'sports_bet' ? (
                    <WagerForm money={me?.money ?? 0} onWager={(amount) => run(() => resolveCard(amount))} />
                  ) : (
                    <button className="btn primary" onClick={() => void run(() => resolveCard())}>
                      {cardNeedsD20 ? 'Roll d20 for this card' : 'Continue'}
                    </button>
                  ) : (
                    <p className="muted">Waiting for {current?.name} to resolve the card.</p>
                  )}
                  {isMyTurn && error && <p className="error" role="alert">{error}</p>}
                </section>
              )}
              {canEndTurn && (
                <button type="button" className="btn primary board-roll-btn" onClick={() => void run(endTurn)}>
                  End turn
                </button>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
