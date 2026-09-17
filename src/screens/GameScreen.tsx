import { useState } from 'react';
import { Board } from '../components/Board';
import { Carats } from '../components/Carats';
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

export function GameScreen({ room, selfId }: Props) {
  const me = room.players.find((p) => p.id === selfId);
  const current = room.players[room.turnIndex];
  const isMyTurn = current?.id === selfId;
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

  return (
    <div className="game-page">
      <aside className="sidebar">
        <p className="brand-sm">Tracen Trading Training</p>
        <h2 className="turn-line">
          {room.phase === 'finished'
            ? `${winner?.name ?? 'Someone'} wins!`
            : isMyTurn
              ? 'Your turn'
              : `${current?.name}'s turn`}
        </h2>

        <ul className="scoreboard">
          {room.players.map((p) => (
            <li
              key={p.id}
              className={`${p.id === current?.id ? 'active' : ''} ${p.bankrupt ? 'out' : ''}`}
            >
              <span className="dot" style={{ background: p.color }} />
              <div>
                <strong>
                  {p.name}
                  {p.id === selfId ? ' (you)' : ''}
                </strong>
                <div className="muted">
                  {p.bankrupt ? (
                    'Out'
                  ) : (
                    <Carats amount={p.money} />
                  )}
                  {p.inJail ? ' · Rest Box' : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="actions">
          {room.phase === 'playing' &&
            isMyTurn &&
            room.pending.type === 'none' &&
            room.canRoll &&
            !me?.inJail && (
              <button className="btn primary" onClick={() => void run(rollDice)}>
                Roll dice
              </button>
            )}

          {room.phase === 'playing' &&
            isMyTurn &&
            room.pending.type === 'none' &&
            !room.canRoll &&
            !me?.inJail && (
              <button className="btn primary" onClick={() => void run(endTurn)}>
                End turn
              </button>
            )}

          {isMyTurn && room.pending.type === 'buy_or_pass' && (
            <div className="action-stack">
              <p>
                Acquire space #{room.pending.spaceId} for{' '}
                <Carats amount={room.pending.price} />?
              </p>
              <button className="btn primary" onClick={() => void run(buyProperty)}>
                Buy
              </button>
              <button className="btn ghost" onClick={() => void run(passProperty)}>
                Pass
              </button>
            </div>
          )}

          {isMyTurn && room.pending.type === 'pay_rent' && (
            <div className="action-stack">
              <p>
                Pay <Carats amount={room.pending.amount} /> rent
              </p>
              <button className="btn primary" onClick={() => void run(payDue)}>
                Pay
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

          {isMyTurn && room.pending.type === 'card' && (
            <div className="action-stack card-reveal">
              {room.pending.deck === 'chance' ? (
                <img className="fuji-card-art" src="/fuji-hat.png" alt="" />
              ) : null}
              <p className="eyebrow">
                {room.pending.deck === 'chance' ? "Fuji's Hat" : 'Stable Memo'}
              </p>
              <p>{room.pending.card.text}</p>
              <button className="btn primary" onClick={() => void run(resolveCard)}>
                Continue
              </button>
            </div>
          )}

          {isMyTurn &&
            me?.inJail &&
            !me.bankrupt &&
            (room.pending.type === 'jail_choice' ||
              room.pending.type === 'none') &&
            (room.canRoll || room.pending.type === 'jail_choice') && (
              <div className="action-stack">
                <p>Rest Box — choose an exit</p>
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
        <Board room={room} />
      </div>
    </div>
  );
}
