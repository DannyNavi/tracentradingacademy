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

/**
 * Clockwise from Starting Gate (bottom-left):
 * bottom → right (up) → top (left) → left (down) → back to gate.
 * CSS grids fill top→bottom / left→right, so vertical edges are ordered for that.
 */
export function Board({ room }: Props) {
  const spaces = room.content.properties;
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  // Bottom: Starting Gate, then browns / early spaces, Rest Box (L→R)
  const bottom = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Right: walk up from Rest Box — grid is top→bottom so high ids first
  const rightTopToBottom = [19, 18, 17, 16, 15, 14, 13, 12, 11];
  // Top: walk left from Winner's Circle — grid is L→R so 30 … 20
  const topLeftToRight = [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20];
  // Left: walk down toward Starting Gate — Grand Lawn near top, Crown Stakes above gate
  const leftTopToBottom = [31, 32, 33, 34, 35, 36, 37, 38, 39];

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

      <div className="edge bottom">
        {bottom.map((id) => (
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
