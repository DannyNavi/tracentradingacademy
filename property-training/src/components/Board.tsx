import { useEffect, useRef, useState } from 'react';
import type { BoardSpace, PlayerPublic, RoomState } from '../lib/types';
import { getCharacter } from '../lib/characters';
import { TOKEN_MOVE_DURATION_MS } from '../lib/animTiming';
import { Carats } from './Carats';
import { DiceRoll } from './DiceRoll';

const BOARD_SIZE = 40;

type Props = {
  room: RoomState;
  canRoll?: boolean;
  onRoll?: () => void;
  /** Hide lobby code / roll UI for static map preview */
  preview?: boolean;
};

type PlayerSnapshot = Pick<PlayerPublic, 'position' | 'inJail' | 'bankrupt'>;

function tokensOn(spaceId: number, players: PlayerPublic[]) {
  return players.filter((p) => !p.bankrupt && p.position === spaceId);
}

function isCafeteria(space: BoardSpace) {
  return space.kind === 'utility' && space.name === 'Cafeteria';
}

/** Clockwise steps from `from` to `to` (exclusive of from, inclusive of to). */
function forwardPath(from: number, to: number): number[] {
  if (from === to) return [];
  const path: number[] = [];
  let cur = from;
  do {
    cur = (cur + 1) % BOARD_SIZE;
    path.push(cur);
  } while (cur !== to);
  return path;
}

function isJailSend(prev: PlayerSnapshot | undefined, next: PlayerPublic): boolean {
  if (!next.inJail || next.position !== 10) return false;
  if (!prev) return true;
  return !prev.inJail || prev.position !== 10;
}

function BoardCell({
  space,
  players,
  ownership,
}: {
  space: BoardSpace;
  players: PlayerPublic[];
  ownership: Record<number, string>;
}) {
  const here = tokensOn(space.id, players);
  const ownerId = ownership[space.id];
  const owner = players.find((p) => p.id === ownerId);
  const cafeteria = isCafeteria(space);

  return (
    <div
      className={`cell kind-${space.kind}${cafeteria ? ' cell-has-cafeteria' : ''}`}
      style={{ ['--group' as string]: space.color || 'transparent' }}
      title={
        space.price
          ? `${space.name} · ${space.price} carats`
          : space.name
      }
    >
      {cafeteria ? (
        <img
          className="cell-cafeteria"
          src="/cafeteria.png"
          alt=""
          draggable={false}
        />
      ) : null}
      {(space.kind === 'property' || space.kind === 'rail' || space.kind === 'utility') &&
      !cafeteria ? (
        <div className="cell-stripe" />
      ) : null}
      {space.kind === 'chance' ? (
        <img className="cell-fuji" src="/fuji-hat.png" alt="" draggable={false} />
      ) : null}
      {space.kind === 'gotojail' ? (
        <img
          className="cell-slacker"
          src="/new-condition-slacker.png"
          alt=""
          draggable={false}
        />
      ) : null}
      {space.kind !== 'gotojail' ? (
        <div className={`cell-name${cafeteria ? ' cell-name-on-art' : ''}`}>{space.name}</div>
      ) : null}
      {space.price ? (
        <div className={`cell-price${cafeteria ? ' cell-price-on-art' : ''}`}>
          <Carats amount={space.price} />
        </div>
      ) : null}
      {owner ? <div className="cell-owner" style={{ background: owner.color }} /> : null}
      <div className="cell-tokens">
        {here.map((p) => {
          const chara = getCharacter(p.characterId);
          return chara ? (
            <img
              key={`${p.id}@${space.id}`}
              className="token-chara"
              src={chara.image}
              alt={p.name}
              title={`${p.name} · ${chara.name}`}
              style={{ borderColor: p.color }}
            />
          ) : (
            <span
              key={`${p.id}@${space.id}`}
              className="token"
              style={{ background: p.color }}
              title={p.name}
            />
          );
        })}
      </div>
    </div>
  );
}

function snapshotPlayers(players: PlayerPublic[]): Record<string, PlayerSnapshot> {
  const out: Record<string, PlayerSnapshot> = {};
  for (const p of players) {
    out[p.id] = { position: p.position, inJail: p.inJail, bankrupt: p.bankrupt };
  }
  return out;
}

function positionsEqual(
  a: Record<string, PlayerSnapshot>,
  b: Record<string, PlayerSnapshot>,
): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id];
    const y = b[id];
    if (!x || !y) return false;
    if (x.position !== y.position || x.inJail !== y.inJail || x.bankrupt !== y.bankrupt) {
      return false;
    }
  }
  return true;
}

/**
 * Classic property-board orientation (GO bottom-right, clockwise):
 * bottom ← left ↑ top → right ↓ back to GO.
 * CSS grids fill left→right / top→bottom.
 */
export function Board({ room, canRoll = false, onRoll, preview = false }: Props) {
  const spaces = room.content.properties;
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  const bottomLeftToRight = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const leftTopToBottom = [19, 18, 17, 16, 15, 14, 13, 12, 11];
  const topLeftToRight = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const rightTopToBottom = [31, 32, 33, 34, 35, 36, 37, 38, 39];

  const [visualPositions, setVisualPositions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of room.players) init[p.id] = p.position;
    return init;
  });

  const visualRef = useRef(visualPositions);
  const prevSnapRef = useRef<Record<string, PlayerSnapshot> | null>(null);
  const timersRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    visualRef.current = visualPositions;
  }, [visualPositions]);

  useEffect(() => {
    const timersByPlayer = timersRef.current;
    return () => {
      for (const timers of Object.values(timersByPlayer)) {
        timers.forEach((t) => window.clearTimeout(t));
      }
    };
  }, []);

  useEffect(() => {
    const nextSnap = snapshotPlayers(room.players);

    const clearTimers = (playerId: string) => {
      const timers = timersRef.current[playerId];
      if (timers) {
        timers.forEach((t) => window.clearTimeout(t));
        timersRef.current[playerId] = [];
      }
    };

    const snapAll = () => {
      const next: Record<string, number> = {};
      for (const p of room.players) next[p.id] = p.position;
      setVisualPositions(next);
      for (const id of Object.keys(timersRef.current)) clearTimers(id);
    };

    if (preview) {
      snapAll();
      prevSnapRef.current = nextSnap;
      return;
    }

    const prev = prevSnapRef.current;
    if (!prev) {
      snapAll();
      prevSnapRef.current = nextSnap;
      return;
    }

    if (positionsEqual(prev, nextSnap)) {
      return;
    }

    for (const p of room.players) {
      const old = prev[p.id];
      if (!old) {
        clearTimers(p.id);
        setVisualPositions((v) => ({ ...v, [p.id]: p.position }));
        continue;
      }

      if (old.position === p.position) continue;

      clearTimers(p.id);

      // Infirmary teleport (gotojail / triples / card): snap, don't walk the long way.
      if (isJailSend(old, p)) {
        setVisualPositions((v) => ({ ...v, [p.id]: p.position }));
        continue;
      }

      const from = visualRef.current[p.id] ?? old.position;
      const path = forwardPath(from, p.position);
      if (path.length === 0) {
        setVisualPositions((v) => ({ ...v, [p.id]: p.position }));
        continue;
      }

      const stepMs = TOKEN_MOVE_DURATION_MS / path.length;
      const timers: number[] = [];
      path.forEach((tile, i) => {
        timers.push(
          window.setTimeout(() => {
            setVisualPositions((v) => ({ ...v, [p.id]: tile }));
          }, Math.round(stepMs * (i + 1))),
        );
      });
      timersRef.current[p.id] = timers;
    }

    // Drop visuals for players who left
    setVisualPositions((v) => {
      const next = { ...v };
      for (const id of Object.keys(next)) {
        if (!nextSnap[id]) delete next[id];
      }
      return next;
    });

    prevSnapRef.current = nextSnap;
  }, [room.players, preview]);

  const visualPlayers: PlayerPublic[] = room.players.map((p) => ({
    ...p,
    position: visualPositions[p.id] ?? p.position,
  }));

  return (
    <div className="board">
      <div className="board-center">
        <p className="brand-sm">Tracen Trading Academy</p>
        <p className="board-center-sub">{preview ? 'Board preview' : `Lobby ${room.code}`}</p>
        {!preview ? (
          <DiceRoll
            dice={room.lastDice}
            animKey={room.lastDice ? `${room.log[0] ?? ''}:${room.lastDice.join('-')}` : ''}
          />
        ) : (
          <p className="muted board-preview-hint">Static map — no lobby needed</p>
        )}
        {canRoll && onRoll ? (
          <button type="button" className="btn primary board-roll-btn" onClick={onRoll}>
            Roll dice
          </button>
        ) : null}
      </div>

      <div className="edge bottom">
        {bottomLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={visualPlayers} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge right">
        {rightTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={visualPlayers} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge top">
        {topLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={visualPlayers} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge left">
        {leftTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={visualPlayers} ownership={room.ownership} />
        ))}
      </div>
    </div>
  );
}
