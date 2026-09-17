const PLAYER_KEY = 'tta-player-id';
const SESSION_KEY = 'tta-session';

export type SessionInfo = {
  roomCode: string;
  playerId: string;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

export function saveSession(roomCode: string, playerId: string) {
  const session: SessionInfo = { roomCode: roomCode.toUpperCase(), playerId };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): SessionInfo | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionInfo;
    if (!parsed?.roomCode || !parsed?.playerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
