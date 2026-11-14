import { useState } from 'react';
import { forceEndGame } from '../lib/socket';

export function EndGameButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function endGame() {
    if (!window.confirm('End the game for everyone? The game will finish without a winner.')) return;
    setBusy(true);
    setError('');
    try {
      const result = await forceEndGame();
      if (!result.ok) throw new Error(result.error || 'Could not end the game.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn danger" disabled={busy} onClick={() => void endGame()}>
        {busy ? 'Ending game…' : 'End game'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
