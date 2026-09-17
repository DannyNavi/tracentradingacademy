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
 * Classic property-board orientation (GO bottom-right, clockwise):
 * bottom ← left ↑ top → right ↓ back to GO.
 * CSS grids fill left→right / top→bottom.
 */
export function Board({ room }: Props) {
  const spaces = room.content.properties;
  const byId = (id: number) => spaces.find((s) => s.id === id)!;

  // Bottom L→R: Rest Box … browns … Starting Gate (GO at bottom-right)
  const bottomLeftToRight = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  // Left T→B: just below Winner's Circle down to just above Rest Box
  const leftTopToBottom = [19, 18, 17, 16, 15, 14, 13, 12, 11];
  // Top L→R: Winner's Circle … Sent to Rest Box
  const topLeftToRight = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  // Right T→B: Grand Lawn … Crown Stakes (immediately above Starting Gate)
  const rightTopToBottom = [31, 32, 33, 34, 35, 36, 37, 38, 39];

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
