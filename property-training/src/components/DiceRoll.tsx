import { useEffect, useRef, useState } from 'react';
import { DICE_ROLL_DURATION_MS } from '../lib/animTiming';

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ value }: { value: number }) {
  const pips = PIP_MAP[value] ?? PIP_MAP[1];
  return (
    <div className="die" aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`pip ${pips.includes(i) ? 'on' : ''}`} />
      ))}
    </div>
  );
}

type Props = {
  dice: [number, number] | null;
  /** Changes on every new roll so identical totals still re-animate. */
  animKey: string;
};

export function DiceRoll({ dice, animKey }: Props) {
  const [display, setDisplay] = useState<[number, number] | null>(dice);
  const [rolling, setRolling] = useState(false);
  const lastAnim = useRef('');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    if (!dice) {
      setDisplay(null);
      setRolling(false);
      lastAnim.current = '';
      return;
    }

    if (animKey && animKey === lastAnim.current) {
      setDisplay(dice);
      setRolling(false);
      return;
    }

    lastAnim.current = animKey;
    setRolling(true);

    const final = dice;
    const start = performance.now();
    const duration = DICE_ROLL_DURATION_MS;

    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= duration) {
        setDisplay(final);
        setRolling(false);
        return;
      }
      setDisplay([
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6),
      ]);
      timers.current.push(window.setTimeout(tick, 65));
    };
    tick();
  }, [dice, animKey]);

  if (!display) {
    return <p className="dice-readout muted">Roll when ready</p>;
  }

  const total = display[0] + display[1];

  return (
    <div className={`dice-stage ${rolling ? 'is-rolling' : 'is-settled'}`}>
      <div className="dice-pair">
        <DieFace value={display[0]} />
        <DieFace value={display[1]} />
      </div>
      <p className="dice-total">{rolling ? 'Rolling…' : `= ${total}`}</p>
    </div>
  );
}
