import type { BoardSpace, PlayerPublic, RoomState } from '../lib/types';
import { getCharacter } from '../lib/characters';
import { Carats } from './Carats';
import { DiceRoll } from './DiceRoll';

type Props = {
  room: RoomState;
  canRoll?: boolean;
  onRoll?: () => void;
  /** Hide lobby code / roll UI for static map preview */
  preview?: boolean;
};

function tokensOn(spaceId: number, players: PlayerPublic[]) {
  return players.filter((p) => !p.bankrupt && p.position === spaceId);
}

function cellArt(space: BoardSpace): { src: string; fit: 'cover' | 'contain' } | null {
  if (space.kind === 'jail' || space.name === 'Infirmary') {
    return { src: '/infirmary.png', fit: 'cover' };
  }
  if (space.kind === 'utility' && space.name === 'Cafeteria') {
    return { src: '/cafeteria.png', fit: 'cover' };
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

function TokenStack({ players }: { players: PlayerPublic[] }) {
  return (
    <>
      {players.map((p) => {
        const chara = getCharacter(p.characterId);
        return chara ? (
          <img
            key={p.id}
            className="token-chara"
            src={chara.image}
            alt={p.name}
            title={`${p.name} · ${chara.name}`}
            style={{ borderColor: p.color }}
          />
        ) : (
          <span key={p.id} className="token" style={{ background: p.color }} title={p.name} />
        );
      })}
    </>
  );
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
  const art = cellArt(space);
  const hasArt = Boolean(art);
  const isJail = space.kind === 'jail';
  const inInfirmary = isJail ? here.filter((p) => p.inJail) : [];
  const justVisiting = isJail ? here.filter((p) => !p.inJail) : [];

  return (
    <div
      className={`cell kind-${space.kind}${hasArt ? ` cell-has-art cell-art-${art!.fit}` : ''}${
        isJail ? ' cell-infirmary' : ''
      }`}
      style={{ ['--group' as string]: space.color || 'transparent' }}
      title={
        space.price
          ? `${space.name} · ${space.price} carats`
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
            <div className="cell-tokens cell-tokens-infirmary">
              <TokenStack players={inInfirmary} />
            </div>
          </div>
          <div className="infirmary-visit">
            <span className="infirmary-visit-label">Just Visiting</span>
            <div className="cell-tokens cell-tokens-visit">
              <TokenStack players={justVisiting} />
            </div>
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
          {space.price ? (
            <div className={`cell-price${hasArt ? ' cell-price-on-art' : ''}`}>
              <Carats amount={space.price} />
            </div>
          ) : null}
          {owner ? <div className="cell-owner" style={{ background: owner.color }} /> : null}
          <div className="cell-tokens">
            <TokenStack players={here} />
          </div>
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
export function Board({ room, canRoll = false, onRoll, preview = false }: Props) {
  const spaces = room.content.properties;
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  const bottomLeftToRight = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const leftTopToBottom = [19, 18, 17, 16, 15, 14, 13, 12, 11];
  const topLeftToRight = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const rightTopToBottom = [31, 32, 33, 34, 35, 36, 37, 38, 39];

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
        ) : null}
        {canRoll && onRoll ? (
          <button type="button" className="btn primary board-roll-btn" onClick={onRoll}>
            Roll dice
          </button>
        ) : null}
      </div>

      <div className="edge bottom">
        {bottomLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge right">
        {rightTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge top">
        {topLeftToRight.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge left">
        {leftTopToBottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
    </div>
  );
}
