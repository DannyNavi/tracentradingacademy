import { useEffect, useRef, useState } from 'react';
import { ConfigScreen } from './screens/ConfigScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { clearSession, getPlayerId, loadSession, saveSession } from './lib/session';
import { rejoinLobby, socket } from './lib/socket';
import type { RoomState } from './lib/types';
import './App.css';

type View = 'home' | 'config' | 'lobby' | 'game';

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState(() => getPlayerId());
  const [forceConfig, setForceConfig] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [rejoining, setRejoining] = useState(() => Boolean(loadSession()));
  const rejoinedRef = useRef(false);

  useEffect(() => {
    async function tryRejoin() {
      const session = loadSession();
      if (!session) {
        setRejoining(false);
        return;
      }
      if (rejoinedRef.current) return;
      rejoinedRef.current = true;
      setRejoining(true);
      try {
        const res = await rejoinLobby(session.roomCode, session.playerId);
        if (!res.ok || !res.room) throw new Error(res.error || 'Rejoin failed');
        setSelfId(session.playerId);
        setRoom(res.room);
        setForceConfig(res.room.phase === 'config');
        saveSession(res.room.code, session.playerId);
      } catch {
        clearSession();
        setRoom(null);
      } finally {
        setRejoining(false);
      }
    }

    const onConnect = () => {
      setConnected(true);
      void tryRejoin();
    };
    const onDisconnect = () => {
      setConnected(false);
      rejoinedRef.current = false;
    };
    const onState = (next: RoomState) => {
      setRoom(next);
      if (next.phase === 'lobby') setForceConfig(false);
      if (next.phase === 'playing' || next.phase === 'finished') setForceConfig(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    if (socket.connected) void tryRejoin();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
    };
  }, []);

  let view: View = 'home';
  if (room) {
    if (forceConfig || room.phase === 'config') view = 'config';
    else if (room.phase === 'lobby') view = 'lobby';
    else view = 'game';
  }

  return (
    <div className="app-shell">
      {!connected ? <div className="banner">Connecting to server…</div> : null}
      {connected && rejoining ? <div className="banner">Rejoining lobby…</div> : null}
      {view === 'home' && !rejoining && (
        <HomeScreen
          onJoined={(r, id) => {
            setRoom(r);
            setSelfId(id);
            setForceConfig(r.phase === 'config');
            saveSession(r.code, id);
          }}
        />
      )}
      {view === 'config' && room && (
        <ConfigScreen room={room} selfId={selfId} onDone={() => setForceConfig(false)} />
      )}
      {view === 'lobby' && room && (
        <LobbyScreen room={room} selfId={selfId} onEditBoard={() => setForceConfig(true)} />
      )}
      {view === 'game' && room && <GameScreen room={room} selfId={selfId} />}
    </div>
  );
}
