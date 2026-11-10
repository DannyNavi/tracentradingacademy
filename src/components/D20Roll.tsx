import { useEffect, useRef, useState } from 'react';
import { rollD20 } from '../lib/d20';

/** Standalone roller; onResult can later connect the die to a game event. */
export function D20Roll({ onResult }: { onResult?: (value: number) => void }) {
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  function roll() {
    if (locked.current) return;
    const next = rollD20();
    locked.current = true;
    setRolling(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000;
    timer.current = setTimeout(() => {
      setResult(next);
      setRolling(false);
      locked.current = false;
      timer.current = null;
      onResult?.(next);
    }, duration);
  }

  return (
    <section className="d20-panel" aria-label="Twenty-sided die">
      <h3>D20</h3>
      <div className={`d20-stage${rolling ? ' is-rolling' : ''}`}>
        <svg className="d20-die" viewBox="0 0 120 132" aria-hidden="true">
          <polygon className="d20-shell" points="60,4 112,34 112,96 60,128 8,96 8,34" />
          <path className="d20-facets" d="M60 4 L32 48 L8 34 M60 4 L88 48 L112 34 M8 34 L32 48 L8 96 L60 128 L32 48 L88 48 L60 128 L112 96 L88 48 L112 34 M8 96 L60 96 L112 96 M32 48 L60 96 L88 48" />
          <text x="60" y="75" textAnchor="middle">{rolling ? '?' : result ?? '20'}</text>
        </svg>
      </div>
      <p role="status" aria-live="polite" className="d20-result">
        {rolling ? 'Rolling d20…' : result === null ? 'Ready to roll' : `D20 result: ${result}`}
      </p>
      <button type="button" className="btn ghost" onClick={roll} disabled={rolling}>
        {rolling ? 'Rolling…' : 'Roll d20'}
      </button>
    </section>
  );
}
