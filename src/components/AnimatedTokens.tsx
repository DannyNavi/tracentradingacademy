import { useEffect, useRef } from 'react';
import type { PlayerPublic } from '../lib/types';
import { getCharacter } from '../lib/characters';

function location(position: number, index: number, inJail: boolean) {
  const [x, y] = position <= 10 ? [10 - position, 10]
    : position <= 20 ? [0, 20 - position]
    : position <= 30 ? [position - 20, 0] : [10, position - 30];
  // Keep players sharing a tile distinct, with visitors below the Infirmary.
  const jailY = position === 10 ? (inJail ? 0.35 : 0.82) : 0.7;
  return {
    left: `${(x + 0.22 + (index % 3) * 0.24) / 11 * 100}%`,
    top: `${(y + jailY - Math.floor(index / 3) * 0.22) / 11 * 100}%`,
  };
}

function AnimatedToken({ player, index, rollId }: { player: PlayerPublic; index: number; rollId: number }) {
  const element = useRef<HTMLDivElement>(null);
  const seen = useRef(player.movements?.at(-1)?.id ?? 0);
  const previousRoll = useRef(rollId);
  const queue = useRef(Promise.resolve());
  const active = useRef<Animation | null>(null);
  const mounted = useRef(false);
  const character = getCharacter(player.characterId);
  const latestMovement = player.movements?.at(-1)?.id ?? 0;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.cancel(); };
  }, []);

  useEffect(() => {
    const moves = (player.movements ?? []).filter((move) => move.id > seen.current);
    const delay = previousRoll.current !== rollId ? 950 : 0;
    previousRoll.current = rollId;
    seen.current = latestMovement;
    if (!moves.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const path = moves.flatMap((move, i) => i === 0 ? move.path : move.path.slice(1));
    const keyframes = path.map((position) => location(position, index, position === 10 && player.inJail));
    queue.current = queue.current.then(async () => {
      if (!mounted.current || !element.current) return;
      const animation = element.current.animate(keyframes, {
        duration: Math.max(1, path.length - 1) * 150,
        delay, easing: 'linear', fill: 'both',
      });
      active.current = animation;
      try { await animation.finished; } catch { /* Unmounted animations are cancelled. */ }
      animation.cancel();
    });
  }, [latestMovement, rollId, player.movements, player.inJail, index]);

  return (
    <div ref={element} className="board-token" style={location(player.position, index, player.inJail)}>
      {character ? (
        <img className="token-chara" src={character.image} alt={player.name}
          title={`${player.name} · ${character.name}`} style={{ borderColor: player.color }} />
      ) : (
        <span className="token" role="img" aria-label={player.name} title={player.name} style={{ background: player.color }} />
      )}
    </div>
  );
}

export function AnimatedTokens({ players, rollId }: { players: PlayerPublic[]; rollId: number }) {
  return <div className="board-tokens">{players.map((player, index) => !player.bankrupt && (
    <AnimatedToken key={player.id} player={player} index={index} rollId={rollId} />
  ))}</div>;
}
