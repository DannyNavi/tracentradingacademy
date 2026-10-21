import { useEffect, useId, useRef } from 'react';
import type { BoardSpace, RoomState } from '../lib/types';
import { calculateRent, rentTerms } from '../lib/rent';
import { Carats } from './Carats';

const SPECIAL_RULES = {
  go: 'Collect 200 carats when you pass or land here.',
  tax: 'Pay the listed fee when you land here.',
  chance: "Draw a card from Fuji’s Hat and follow its instructions.",
  community: 'Draw a Raffle Ticket and follow its instructions.',
  jail: 'Visitors pay nothing. In the Infirmary, leave with doubles, a free pass, or 50 carats. After three failed rolls, pay 50 carats and move.',
  gotojail: 'Go directly to the Infirmary. Do not collect race earnings.',
  free: 'Take a break here. No payment is required.',
};

export function TileDetails({ room, space, onClose }: {
  room: RoomState; space: BoardSpace; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const owner = room.players.find((player) => player.id === room.ownership[space.id]);
  const purchasable = ['property', 'rail', 'utility'].includes(space.kind);
  const terms = rentTerms(room, space);
  const due = room.pending.type === 'pay_rent' && room.pending.spaceId === space.id ? room.pending : null;

  useEffect(() => {
    const element = dialog.current!;
    if (!element.open) element.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="tile-details" aria-labelledby={titleId} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="tile-details-body" style={{ borderTopColor: space.color ?? 'var(--accent-deep)' }}>
        <div className="tile-details-heading">
          <div><p className="eyebrow">Space {space.id} · {space.kind === 'rail' ? 'Transport' : space.kind}</p>
            <h2 id={titleId}>{space.name}</h2></div>
          <button type="button" className="btn ghost" onClick={() => dialog.current?.close()} aria-label="Close tile details">✕</button>
        </div>
        {purchasable ? <>
          <dl className="tile-facts">
            <div><dt>Owner</dt><dd>{owner?.name ?? 'Unowned'}</dd></div>
            <div><dt>Purchase price</dt><dd><Carats amount={space.price ?? 0} /></dd></div>
            <div><dt>{owner ? 'Current rent' : 'Starting rent'}</dt><dd>
              {space.kind === 'utility' ? `${terms.multiplier} × dice total` : <Carats amount={terms.fixed} />}
            </dd></div>
          </dl>
          <p className="muted">{owner ? 'Other players pay the owner when they land here. The owner pays no rent.'
            : 'No rent is charged while unowned. The player who lands here can buy it.'}</p>
          {space.kind === 'property' && <>
            <p>Base rent: <Carats amount={space.rent ?? 0} />. {terms.group.length > 0 && <>
              Own the complete group to double rent to <Carats amount={(space.rent ?? 0) * 2} />.
              {terms.completeGroup ? ' Complete group bonus is active.' : ''}</>}</p>
            {terms.group.length > 0 && <><h3>Property group</h3><ul className="tile-group">
              {terms.group.map((member) => <li key={member.id}>
                <span>{member.name}</span><span className="muted">{room.players.find((player) => player.id === room.ownership[member.id])?.name ?? 'Unowned'}</span>
              </li>)}
            </ul></>}
          </>}
          {space.kind === 'rail' && <><h3>Transport rent</h3><ul className="tile-group">
            {[25, 50, 100, 200].map((rent, i) => <li key={rent} className={owner && terms.owned === i + 1 ? 'rent-active' : ''}>
              <span>{i + 1} transport{i ? 's' : ''} owned{owner && terms.owned === i + 1 ? ' · current' : ''}</span><Carats amount={rent} />
            </li>)}
          </ul></>}
          {space.kind === 'utility' && <>
            <p>One utility: 4 × dice total. Both utilities: 10 × dice total.</p>
            {room.lastDice && <p className="muted">Using the last roll ({room.lastDice.join(' + ')}): <Carats amount={calculateRent(room, space, room.lastDice[0] + room.lastDice[1])} />{owner ? '.' : ' if purchased.'}</p>}
          </>}
          {due && <p className="tile-rent-due" role="status">{room.players[room.turnIndex]?.name} owes <Carats amount={due.amount} /> to {owner?.name}. Pay rent in the turn panel to continue.</p>}
        </> : <>
          <p>{SPECIAL_RULES[space.kind as keyof typeof SPECIAL_RULES]}</p>
          {space.kind === 'tax' && <p>Fee: <Carats amount={space.taxAmount ?? 0} /></p>}
        </>}
      </div>
    </dialog>
  );
}
