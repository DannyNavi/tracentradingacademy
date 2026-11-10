import { useState } from 'react';
import { DiceRoll } from '../components/DiceRoll';
import { getCharacter } from '../lib/characters';
import { rollStartingDice } from '../lib/socket';
import type { RoomState } from '../lib/types';

export function StartingRollScreen({ room, selfId }: { room: RoomState; selfId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const round = room.startingRound;
  const startingPlayer = !round ? room.players[room.turnIndex] : undefined;
  const roundNumber = round?.number ?? room.startRolls?.at(-1)?.round ?? 1;
  const eligible = round?.eligibleIds.includes(selfId);
  const alreadyRolled = Boolean(round?.rolls[selfId]);
  const waiting = round?.eligibleIds.filter((id) => !round.rolls[id]) ?? [];
  async function roll() {
    if (!round) return;
    setBusy(true); setError('');
    try { const result = await rollStartingDice(round.number); if (!result.ok) throw new Error(result.error); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <main className="starting-page">
    <header className="starting-header"><p className="brand-sm">Tracen Trading Academy · Lobby {room.code}</p>
      <p className="eyebrow">Choose who goes first · Round {roundNumber}</p>
      <h1>{startingPlayer ? `${startingPlayer.name} goes first!` : roundNumber > 1 ? 'A tie! Roll again.' : 'Roll for first turn'}</h1>
      {round && <p>{roundNumber > 1 ? 'Only the players tied for the highest total reroll. Everyone else keeps their place in the game.' : 'Each trainer rolls two dice. The highest total takes the first turn.'}</p>}
    </header>
    <div className="starting-players">{room.players.map((player) => {
      const character = getCharacter(player.characterId);
      const canReroll = round?.eligibleIds.includes(player.id);
      const history = (room.startRolls ?? []).map((entry, index) => ({ ...entry, index })).filter((entry) => entry.playerId === player.id);
      const latest = history.at(-1);
      const currentDice = round?.rolls[player.id] ?? (!round && latest?.round === roundNumber ? latest.dice : undefined);
      return <section className={`starting-player ${player.id === selfId ? 'is-you' : ''}`} key={player.id} aria-label={`${player.name}'s starting roll`}>
        {character && <img className="starting-character" src={character.image} alt={character.name} />}
        <h2>{player.name}{player.id === selfId ? ' (you)' : ''}</h2>
        <DiceRoll dice={latest?.dice ?? null} animKey={latest ? `${room.code}:starting:${latest.index}` : ''}
          idleMessage={canReroll ? player.id === selfId ? 'Your roll' : 'Waiting to roll' : 'Waiting for the tiebreak'} />
        <p className="muted">{currentDice ? `Round ${roundNumber}: ${currentDice[0] + currentDice[1]}`
          : !canReroll ? 'Out of the tiebreak · still in the game' : player.connected ? roundNumber > 1 ? 'Reroll needed' : 'Ready to roll' : 'Waiting to reconnect'}</p>
      </section>;
    })}</div>
    {round && <div className="starting-actions">
      {eligible && !alreadyRolled ? <button className="btn primary" onClick={() => void roll()} disabled={busy}>{busy ? 'Rolling…' : roundNumber > 1 ? 'Reroll for first turn' : 'Roll for first turn'}</button>
        : <p role="status">{alreadyRolled ? 'Your roll is in. ' : ''}Waiting for {waiting.map((id) => room.players.find((p) => p.id === id)?.name).join(', ')}.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>}
    {(room.startRolls?.length ?? 0) > 0 && <details className="starting-history"><summary>Starting roll history</summary><ul>{room.startRolls!.map((entry, index) => <li key={index}>
      Round {entry.round ?? 1} · {room.players.find((p) => p.id === entry.playerId)?.name}: {entry.dice.join(' + ')} = {entry.dice[0] + entry.dice[1]}
    </li>)}</ul></details>}
  </main>;
}
