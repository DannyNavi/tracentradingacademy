import { useState } from 'react';
import { startGame } from '../lib/socket';
import type { RoomState } from '../lib/types';

type Props = {
  room: RoomState;
  selfId: string;
  onEditBoard: () => void;
};

export function LobbyScreen({ room, selfId, onEditBoard }: Props) {
  const isHost = room.hostId === selfId;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          {room.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <span>
                {p.name}
                {p.id === selfId ? ' (you)' : ''}
                {p.id === room.hostId ? ' · host' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="lobby-actions">
        {isHost ? (
          <>
            <button className="btn ghost" onClick={onEditBoard}>
              Edit board & events
            </button>
            <button
              className="btn primary"
              disabled={busy || room.players.length < 2}
              onClick={() => void handleStart()}
            >
              Start game
            </button>
          </>
        ) : (
          <p className="muted">Waiting for the host to start…</p>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
