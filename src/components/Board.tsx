import { AnimatedTokens } from './AnimatedTokens';
import { useState } from 'react';
import { TileDetails } from './TileDetails';
import type { BoardSpace, PlayerPublic, RoomState } from '../lib/types';
import { Carats } from './Carats';
import { DiceRoll } from './DiceRoll';

type Props = {
  room: RoomState;
  canRoll?: boolean;
  diceIdleMessage?: string;
  onRoll?: () => void;
  /** Hide lobby code / roll UI for static map preview */
  preview?: boolean;
};

function cellArt(space: BoardSpace): { src: string; fit: 'cover' | 'contain' } | null {
  if (space.kind === 'jail' || space.name === 'Infirmary') {
    return { src: '/infirmary.png', fit: 'cover' };
  }
  if (space.kind === 'utility' && space.name === 'Cafeteria') {
    return { src: '/cafeteria.png', fit: 'cover' };
  }
  if (space.kind === 'rail' && (space.id === 5 || space.name === 'Tracen Gym')) {
    return { src: '/tracen-gym.jpg', fit: 'cover' };
  }
  if (space.kind === 'rail' && (space.id === 15 || space.name === 'Tracen Classroom')) {
    return { src: '/tracen-classroom.jpg', fit: 'cover' };
  }
  if (
    space.kind === 'rail' &&
    (space.id === 25 || space.name === 'Tracen Academy Main Building')
  ) {
    return { src: '/tracen-main-building.jpg', fit: 'cover' };
  }
  if (space.kind === 'rail' && (space.id === 35 || space.name === 'Tracen Pool')) {
    return { src: '/tracen-pool.jpg', fit: 'cover' };
  }
  if (space.kind === 'utility' && (space.id === 28 || space.name === 'Dorms')) {
    return { src: '/dorms.png', fit: 'cover' };
  }
  if (space.id === 1 || space.name === "Tama's House") {
    return { src: '/tamas-house.jpg', fit: 'cover' };
  }
  if (space.id === 3 || space.name === 'The Stump') {
    return { src: '/echo-stump.png', fit: 'cover' };
  }
  if (space.id === 37 || space.name === 'Hot Spring Getaway') {
    return { src: '/hot-spring-getaway.png', fit: 'contain' };
  }
  if (space.id === 39 || space.name === 'Mejiro Mansion') {
    return { src: '/mejiro-mansion.jpg', fit: 'cover' };
  }
  return null;
}

function BoardCell({
  space,
  players,
  ownership,
  onSelect,
}: {
  space: BoardSpace;
  players: PlayerPublic[];
  ownership: Record<number, string>;
  onSelect: (id: number) => void;
}) {

  const ownerId = ownership[space.id];
  const owner = players.find((p) => p.id === ownerId);
  const art = cellArt(space);
  const hasArt = Boolean(art);
  const isJail = space.kind === 'jail';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${space.name} details`}
      aria-haspopup="dialog"
      onClick={() => onSelect(space.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(space.id);
        }
      }}
      className={`cell kind-${space.kind}${hasArt ? ` cell-has-art cell-art-${art!.fit}` : ''}${
        isJail ? ' cell-infirmary' : ''
      }`}
      style={{ ['--group' as string]: space.color || 'transparent' }}
      title={
        space.price
          ? `${space.name} · ${space.price} carats`
          : space.kind === 'tax' && space.taxAmount
            ? `${space.name} · -${space.taxAmount} carats`
            : isJail
              ? 'Infirmary · Just Visiting'
              : space.name
      }
    >
      {art ? (
        <img
          className={`cell-art cell-art--${art.fit}${space.name === 'The Stump' ? ' cell-art--stump' : ''}${
            isJail ? ' cell-art--infirmary' : ''
          }`}
          src={art.src}
          alt=""
          draggable={false}
        />
      ) : null}
      {(space.kind === 'property' || space.kind === 'rail' || space.kind === 'utility') &&
      (!hasArt || space.kind === 'property') ? (
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
      {isJail ? (
        <>
          <div className="infirmary-in">
            <div className="cell-name cell-name-on-art">Infirmary</div>
          </div>
          <div className="infirmary-visit">
            <span className="infirmary-visit-label">Just Visiting</span>
          </div>
        </>
      ) : (
        <>
          {space.kind !== 'gotojail' ? (
            <div className={`cell-name${hasArt ? ' cell-name-on-art' : ''}`}>{space.name}</div>
          ) : null}
          {space.kind === 'go' ? (
            <div className="cell-price">
              <Carats amount={200} signed />
            </div>
          ) : null}
          {space.kind === 'tax' && space.taxAmount ? (
            <div className="cell-price">
              <Carats amount={-space.taxAmount} />
            </div>
          ) : null}
          {space.price ? (
            <div className={`cell-price${hasArt ? ' cell-price-on-art' : ''}`}>
              <Carats amount={space.price} />
            </div>
          ) : null}
          {owner ? <div className="cell-owner" style={{ background: owner.color }} /> : null}
        </>
      )}
    </div>
  );
}

/**
 * Classic property-board orientation (GO bottom-right, clockwise):
 * bottom ← left ↑ top → right ↓ back to GO.
 * CSS grids fill left→right / top→bottom.
 */
export function Board({ room, canRoll = false, diceIdleMessage = 'Waiting for turn', onRoll, preview = false }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const spaces = room.content.properties;
  const selectedSpace = spaces.find((space) => space.id === selectedId);
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  const bottomLeftToRight = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const leftTopToBottom = [19, 18, 17, 16, 15, 14, 13, 12, 11];
  const topLeftToRight = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const rightTopToBottom = [31, 32, 33, 34, 35, 36, 37, 38, 39];

  return (
    <div className="board">
      {selectedSpace && <TileDetails room={room} space={selectedSpace} onClose={() => setSelectedId(null)} />}
      <AnimatedTokens players={room.players} rollId={room.lastRollId ?? 0} />
      <div className="board-center">
        <p className="brand-sm">Tracen Trading Academy</p>
        <p className="board-center-sub">{preview ? 'Board preview' : `Lobby ${room.code}`}</p>
        {!preview ? (
          <DiceRoll
            dice={room.lastDice}
            idleMessage={diceIdleMessage}
            animKey={room.lastDice ? `${room.code}:${room.lastRollId ?? 0}` : ''}
          />
        ) : null}
        {canRoll && onRoll ? (
          <button type="button" className="btn primary board-roll-btn" onClick={onRoll}>
            Roll dice
          </button>
        ) : null}
      </div>

      <div className="edge bottom">
        {bottomLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} onSelect={setSelectedId} />
        ))}
      </div>
      <div className="edge right">
        {rightTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} onSelect={setSelectedId} />
        ))}
      </div>
      <div className="edge top">
        {topLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} onSelect={setSelectedId} />
        ))}
      </div>
      <div className="edge left">
        {leftTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} onSelect={setSelectedId} />
        ))}
      </div>
    </div>
  );
}
