import { useMemo, useState } from 'react';
import { openLobby, updateContent } from '../lib/socket';
import type { CardEffect, GameCard, GameContent, RoomState } from '../lib/types';

type Props = {
  room: RoomState;
  selfId: string;
  onDone: () => void;
};

const EFFECT_OPTIONS: { value: CardEffect['type']; label: string }[] = [
  { value: 'money', label: 'Money (+/−)' },
  { value: 'move', label: 'Move to space #' },
  { value: 'move_relative', label: 'Move relative steps' },
  { value: 'jail', label: 'Send to Rest Box' },
  { value: 'nearest_rail', label: 'Nearest transport' },
  { value: 'get_out_of_jail', label: 'Get out free' },
];

function effectValue(effect: CardEffect): number {
  if (effect.type === 'money') return effect.amount;
  if (effect.type === 'move') return effect.position;
  if (effect.type === 'move_relative') return effect.steps;
  return 0;
}

function makeEffect(type: CardEffect['type'], value: number): CardEffect {
  switch (type) {
    case 'money':
      return { type, amount: value };
    case 'move':
      return { type, position: Math.max(0, Math.min(39, value)) };
    case 'move_relative':
      return { type, steps: value };
    case 'jail':
      return { type };
    case 'nearest_rail':
      return { type };
    case 'get_out_of_jail':
      return { type };
  }
}

export function ConfigScreen({ room, selfId, onDone }: Props) {
  const isHost = room.hostId === selfId;
  const [tab, setTab] = useState<'properties' | 'chance' | 'community'>('properties');
  const [content, setContent] = useState<GameContent>(() => structuredClone(room.content));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const editableSpaces = useMemo(
    () =>
      content.properties.filter(
        (s) =>
          s.kind === 'property' ||
          s.kind === 'rail' ||
          s.kind === 'utility' ||
          s.kind === 'tax' ||
          s.kind === 'go' ||
          s.kind === 'jail' ||
          s.kind === 'free' ||
          s.kind === 'gotojail' ||
          s.kind === 'chance' ||
          s.kind === 'community',
      ),
    [content.properties],
  );

  if (!isHost) {
    return (
      <div className="panel-page">
        <h2>Host is customizing the board</h2>
        <p className="muted">Hang tight — you’ll see the lobby when they save.</p>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              {p.name}
              {p.id === room.hostId ? ' (host)' : ''}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function updateSpace(id: number, patch: Partial<GameContent['properties'][number]>) {
    setContent((c) => ({
      ...c,
      properties: c.properties.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function updateCard(deck: 'chance' | 'community', index: number, patch: Partial<GameCard>) {
    setContent((c) => ({
      ...c,
      [deck]: c[deck].map((card, i) => (i === index ? { ...card, ...patch } : card)),
    }));
  }

  function addCard(deck: 'chance' | 'community') {
    setContent((c) => ({
      ...c,
      [deck]: [
        ...c[deck],
        {
          id: `${deck}-${Date.now()}`,
          text: 'New event — edit me',
          effect: { type: 'money', amount: 50 },
        },
      ],
    }));
  }

  function removeCard(deck: 'chance' | 'community', index: number) {
    setContent((c) => ({
      ...c,
      [deck]: c[deck].filter((_, i) => i !== index),
    }));
  }

  async function save(andOpen: boolean) {
    setSaving(true);
    setError('');
    try {
      const res = await updateContent(content);
      if (!res.ok) throw new Error(res.error || 'Save failed');
      if (andOpen && res.room?.phase !== 'lobby') {
        const open = await openLobby();
        if (!open.ok) throw new Error(open.error || 'Could not open lobby');
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="config-page">
      <header className="config-header">
        <div>
          <p className="eyebrow">Lobby {room.code}</p>
          <h2>Customize your circuit</h2>
          <p className="muted">Rename properties and rewrite Fuji&apos;s Hat / Stable Memo events.</p>
        </div>
        <button className="btn primary" disabled={saving} onClick={() => void save(true)}>
          {saving ? 'Saving…' : 'Save & open lobby'}
        </button>
      </header>

      <div className="tabs">
        <button className={tab === 'properties' ? 'active' : ''} onClick={() => setTab('properties')}>
          Properties
        </button>
        <button className={tab === 'chance' ? 'active' : ''} onClick={() => setTab('chance')}>
          Fuji&apos;s Hat
        </button>
        <button className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}>
          Stable Memo
        </button>
      </div>

      {tab === 'properties' ? (
        <div className="config-grid">
          {editableSpaces.map((space) => (
            <article key={space.id} className="config-card">
              <div className="config-card-top">
                <span className="space-id">#{space.id}</span>
                <span className="kind-pill">{space.kind}</span>
                {space.color ? (
                  <span className="swatch" style={{ background: space.color }} />
                ) : null}
              </div>
              <label>
                Name
                <input
                  value={space.name}
                  onChange={(e) => updateSpace(space.id, { name: e.target.value })}
                />
              </label>
              {(space.kind === 'property' || space.kind === 'rail' || space.kind === 'utility') && (
                <div className="row-2">
                  <label>
                    Price
                    <input
                      type="number"
                      value={space.price ?? 0}
                      onChange={(e) => updateSpace(space.id, { price: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Rent
                    <input
                      type="number"
                      value={space.rent ?? 0}
                      onChange={(e) => updateSpace(space.id, { rent: Number(e.target.value) })}
                    />
                  </label>
                </div>
              )}
              {space.kind === 'property' && (
                <div className="row-2">
                  <label>
                    Group
                    <input
                      value={space.group ?? ''}
                      onChange={(e) => updateSpace(space.id, { group: e.target.value })}
                    />
                  </label>
                  <label>
                    Color
                    <input
                      type="color"
                      value={space.color ?? '#888888'}
                      onChange={(e) => updateSpace(space.id, { color: e.target.value })}
                    />
                  </label>
                </div>
              )}
              {space.kind === 'tax' && (
                <label>
                  Tax amount
                  <input
                    type="number"
                    value={space.taxAmount ?? 0}
                    onChange={(e) => updateSpace(space.id, { taxAmount: Number(e.target.value) })}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
      ) : (
        <CardEditor
          deck={tab}
          cards={content[tab]}
          onChange={(i, patch) => updateCard(tab, i, patch)}
          onAdd={() => addCard(tab)}
          onRemove={(i) => removeCard(tab, i)}
        />
      )}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function CardEditor({
  deck,
  cards,
  onChange,
  onAdd,
  onRemove,
}: {
  deck: 'chance' | 'community';
  cards: GameCard[];
  onChange: (index: number, patch: Partial<GameCard>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="card-editor">
      <div className="card-editor-head">
        <h3>{deck === 'chance' ? "Fuji's Hat events" : 'Stable Memo events'}</h3>
        <button type="button" className="btn ghost" onClick={onAdd}>
          Add event
        </button>
      </div>
      {cards.map((card, index) => (
        <article key={card.id} className="config-card">
          <label>
            Text
            <textarea
              rows={2}
              value={card.text}
              onChange={(e) => onChange(index, { text: e.target.value })}
            />
          </label>
          <div className="row-2">
            <label>
              Effect
              <select
                value={card.effect.type}
                onChange={(e) =>
                  onChange(index, {
                    effect: makeEffect(e.target.value as CardEffect['type'], effectValue(card.effect)),
                  })
                }
              >
                {EFFECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {card.effect.type === 'money' ||
            card.effect.type === 'move' ||
            card.effect.type === 'move_relative' ? (
              <label>
                Value
                <input
                  type="number"
                  value={effectValue(card.effect)}
                  onChange={(e) =>
                    onChange(index, {
                      effect: makeEffect(card.effect.type, Number(e.target.value)),
                    })
                  }
                />
              </label>
            ) : (
              <div />
            )}
          </div>
          <button type="button" className="btn danger" onClick={() => onRemove(index)}>
            Remove
          </button>
        </article>
      ))}
    </div>
  );
}
