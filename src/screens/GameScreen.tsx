import { useState } from 'react';
import { Board } from '../components/Board';
import { Carats } from '../components/Carats';
import { TradingPanel } from '../components/TradingPanel';
import { EconomyPanel } from '../components/EconomyPanel';
import { D20Roll } from '../components/D20Roll';
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

  const canRollOnBoard =
    !room.auction && !room.debts?.length &&
    room.phase === 'playing' &&
    isMyTurn &&
    room.pending.type === 'none' &&
    room.canRoll &&
    !me?.inJail;
  const choosingDie = canRollOnBoard && me?.dieChoice === 'ready';

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
        <D20Roll />

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
          {room.phase === 'playing' && !room.auction && !room.debts?.length &&
            isMyTurn &&
            room.pending.type === 'none' &&
            !room.canRoll &&
            (!me?.inJail || !room.canRoll) && (
              <button className="btn primary" onClick={() => void run(endTurn)}>
                End turn
              </button>
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

          {isMyTurn && room.pending.type === 'card' && (
            <div className="action-stack card-reveal">
              {room.pending.deck === 'chance' ? (
                <img className="fuji-card-art" src="/fuji-hat.png" alt="" />
              ) : null}
              <p className="eyebrow">
                {room.pending.deck === 'chance' ? "Fuji's Hat" : 'Raffle Ticket'}
              </p>
              <p>{room.pending.card.text}</p>
              <button className="btn primary" onClick={() => void run(resolveCard)}>
                {room.pending.card.d20Below === undefined ? 'Continue' : 'Roll d20'}
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
        />
      </div>
    </div>
  );
}
