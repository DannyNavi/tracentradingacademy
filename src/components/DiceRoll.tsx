import { useEffect, useState, type CSSProperties } from 'react';

const PIP_MAP: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const ORIENTATION: Record<number, [number, number]> = {
  1: [0, 0], 2: [90, 0], 3: [0, -90],
  4: [0, 90], 5: [-90, 0], 6: [0, 180],
};

function Die({ value }: { value: number }) {
  const [x, y] = ORIENTATION[value];
  return (
    <div className="die-view" role="img" aria-label={`Die showing ${value}`}>
      <div className="die-angle">
        <div className="die" style={{ '--die-x': `${x}deg`, '--die-y': `${y}deg` } as CSSProperties}>
          {[1, 6, 3, 4, 2, 5].map((face, index) => (
            <div key={face} className={`die-face die-face-${index}`} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={`pip ${PIP_MAP[face].includes(i) ? 'on' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Props = {
  dice: [number, number] | null;
  /** Stable roll ID; only a new roll should animate. */
  animKey: string;
};

export function DiceRoll({ dice, animKey }: Props) {
  // Existing results are already settled when the board mounts or reconnects.
  const [animation, setAnimation] = useState({ key: animKey, rolling: false });
  if (animation.key !== animKey) {
    setAnimation({ key: animKey, rolling: Boolean(animKey) });
  }
  const rolling = animation.key === animKey && animation.rolling;

  useEffect(() => {
    if (!animation.rolling) return;
    const timer = window.setTimeout(() => {
      setAnimation((current) => current.key === animKey
        ? { ...current, rolling: false }
        : current);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [animKey, animation.rolling]);
  if (!dice) return <p className="dice-readout muted">Roll when ready</p>;

  return (
    <div className={`dice-stage ${rolling ? 'is-rolling' : 'is-settled'}`}>
      <div className="dice-pair" key={animKey}>
        <Die value={dice[0]} />
        <Die value={dice[1]} />
      </div>
      <p className="dice-total" role="status">{rolling ? 'Rolling…' : `= ${dice[0] + dice[1]}`}</p>
    </div>
  );
}
