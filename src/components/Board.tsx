import type { BoardSpace, PlayerPublic, RoomState } from '../lib/types';

type Props = {
  room: RoomState;
};

function tokensOn(spaceId: number, players: PlayerPublic[]) {
  return players.filter((p) => !p.bankrupt && p.position === spaceId);
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

  return (
    <div
      className={`cell kind-${space.kind}`}
      style={{ ['--group' as string]: space.color || 'transparent' }}
      title={`${space.name}${space.price ? ` · ¥${space.price}` : ''}`}
    >
      {(space.kind === 'property' || space.kind === 'rail' || space.kind === 'utility') && (
        <div className="cell-stripe" />
      )}
      <div className="cell-name">{space.name}</div>
      {space.price ? <div className="cell-price">¥{space.price}</div> : null}
      {owner ? <div className="cell-owner" style={{ background: owner.color }} /> : null}
      <div className="cell-tokens">
        {here.map((p) => (
          <span key={p.id} className="token" style={{ background: p.color }} title={p.name} />
        ))}
      </div>
    </div>
  );
}

/** Classic loop: bottom row L→R is 0..10 visually as GO on corner — we map CSS grid positions. */
export function Board({ room }: Props) {
  const spaces = room.content.properties;
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  // Visual layout matching standard board walking order
  const bottom = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // After 10: up the right edge, across the top (RTL), down the left edge
  const right = [11, 12, 13, 14, 15, 16, 17, 18, 19];
  const top = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const leftSide = [31, 32, 33, 34, 35, 36, 37, 38, 39];

  return (
    <div className="board">
      <div className="board-center">
        <p className="brand-sm">Property Training</p>
        <p className="board-center-sub">Lobby {room.code}</p>
        {room.lastDice ? (
          <p className="dice-readout">
            {room.lastDice[0]} + {room.lastDice[1]}
          </p>
        ) : (
          <p className="dice-readout muted">Roll when ready</p>
        )}
      </div>

      {/* corners + edges via grid areas */}
      <div className="edge bottom">
        {bottom.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge right">
        {right.map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge top">
        {[...top].reverse().map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
      <div className="edge left">
        {[...leftSide].reverse().map((id) => (
          <BoardCell key={id} space={byId(id)} players={room.players} ownership={room.ownership} />
        ))}
      </div>
    </div>
  );
}
