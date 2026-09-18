import { useState } from 'react';
import { selectCharacter, startGame } from '../lib/socket';
import { UMA_CHARACTERS, getCharacter } from '../lib/characters';
import type { RoomState } from '../lib/types';

type Props = {
  room: RoomState;
  selfId: string;
};

export function LobbyScreen({ room, selfId }: Props) {
  const isHost = room.hostId === selfId;
  const me = room.players.find((p) => p.id === selfId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const takenIds = new Set(
    room.players.filter((p) => p.characterId && p.id !== selfId).map((p) => p.characterId!),
  );
  const allReady =
    room.players.length >= 2 && room.players.every((p) => Boolean(p.characterId));

  async function handlePick(characterId: string) {
    setBusy(true);
    setError('');
    try {
      const res = await selectCharacter(characterId);
      if (!res.ok) throw new Error(res.error || 'Could not select');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError('');
    try {
      const res = await startGame();
      if (!res.ok) throw new Error(res.error || 'Could not start');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-page">
      <div className="lobby-code-block">
        <p className="eyebrow">Share this code</p>
        <p className="lobby-code">{room.code}</p>
        <p className="muted">Friends join from the home screen with this code.</p>
      </div>

      <section className="lobby-players">
        <h2>Trainers ({room.players.length}/6)</h2>
        <ul className="player-list">
          {room.players.map((p) => {
            const chara = getCharacter(p.characterId);
            return (
              <li key={p.id}>
                {chara ? (
                  <img className="player-chara" src={chara.image} alt={chara.name} />
                ) : (
                  <span className="dot" style={{ background: p.color }} />
                )}
                <span>
                  {p.name}
                  {p.id === selfId ? ' (you)' : ''}
                  {p.id === room.hostId ? ' · host' : ''}
                  <span className="muted">
                    {' '}
                    · {chara ? chara.name : 'picking…'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="character-select">
        <h2>Pick your trainee</h2>
        <p className="muted">Signature racewear icons — each character can only be chosen once.</p>
        <div className="character-grid">
          {UMA_CHARACTERS.map((c) => {
            const taken = takenIds.has(c.id);
            const mine = me?.characterId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`character-card ${mine ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                disabled={busy || taken}
                onClick={() => void handlePick(c.id)}
                title={taken ? 'Already taken' : c.name}
              >
                <img src={c.image} alt={c.name} draggable={false} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="lobby-actions">
        {isHost ? (
          <button
            className="btn primary"
            disabled={busy || !allReady}
            onClick={() => void handleStart()}
          >
            Start game
          </button>
        ) : (
          <p className="muted">
            {me?.characterId
              ? 'Waiting for the host to start…'
              : 'Pick a character while the host gets ready.'}
          </p>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
