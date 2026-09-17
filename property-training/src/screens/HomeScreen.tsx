import { useEffect, useState } from 'react';
import { createLobby, joinLobby, socket } from '../lib/socket';
import type { RoomState } from '../lib/types';

type Props = {
  onJoined: (room: RoomState, selfId: string) => void;
};

export function HomeScreen({ onJoined }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('pt-name') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem('pt-name', name);
  }, [name]);

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const res = await createLobby(name.trim() || 'Host');
      if (!res.ok || !res.room) throw new Error(res.error || 'Failed');
      onJoined(res.room, socket.id!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError('');
    try {
      const res = await joinLobby(code.trim(), name.trim() || 'Trainer');
      if (!res.ok || !res.room) throw new Error(res.error || 'Failed');
      onJoined(res.room, socket.id!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <div className="home-atmosphere" aria-hidden />
      <header className="home-hero">
        <p className="brand">
          Tracen Trading
          <br />
          Training
        </p>
        <h1>Build the circuit. Call the lobby.</h1>
        <p className="lede">
          Host a room, rename every track and card, then race the board with friends
          anywhere in the world.
        </p>
      </header>

      <form
        className="home-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <label>
          Trainer name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="Your name"
            autoComplete="nickname"
          />
        </label>

        <div className="home-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            Create lobby
          </button>
        </div>

        <div className="join-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ROOM CODE"
            aria-label="Lobby code"
          />
          <button
            type="button"
            className="btn ghost"
            disabled={busy || code.trim().length < 4}
            onClick={() => void handleJoin()}
          >
            Join
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
