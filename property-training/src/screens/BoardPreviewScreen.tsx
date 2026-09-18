import { useEffect, useState } from 'react';
import { Board } from '../components/Board';
import type { GameContent, RoomState } from '../lib/types';

function previewRoom(content: GameContent): RoomState {
  return {
    code: 'PREVIEW',
    hostId: 'preview',
    phase: 'lobby',
    content,
    players: [],
    turnIndex: 0,
    ownership: {},
    lastDice: null,
    doublesCount: 0,
    log: [],
    pending: { type: 'none' },
    winnerId: null,
    canRoll: false,
  };
}

type Props = {
  onBack: () => void;
};

export function BoardPreviewScreen({ onBack }: Props) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/default-content');
        if (!res.ok) throw new Error('Could not load board');
        const content = (await res.json()) as GameContent;
        if (!cancelled) setRoom(previewRoom(content));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="preview-page">
      <header className="preview-header">
        <div>
          <p className="eyebrow">Map preview</p>
          <h1>Board layout</h1>
          <p className="muted">Default circuit — no lobby required.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onBack}>
          Back home
        </button>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {!room && !error ? <p className="muted">Loading board…</p> : null}
      {room ? (
        <div className="preview-board-wrap">
          <Board room={room} preview />
        </div>
      ) : null}
    </div>
  );
}
