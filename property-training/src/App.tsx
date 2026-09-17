import { useEffect, useState } from 'react';
import { ConfigScreen } from './screens/ConfigScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { socket } from './lib/socket';
import type { RoomState } from './lib/types';
import './App.css';

type View = 'home' | 'config' | 'lobby' | 'game';

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState('');
  const [forceConfig, setForceConfig] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (socket.id) setSelfId(socket.id);
    };
    const onDisconnect = () => setConnected(false);
    const onState = (next: RoomState) => {
      setRoom(next);
      if (next.phase === 'lobby') setForceConfig(false);
      if (next.phase === 'playing' || next.phase === 'finished') setForceConfig(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    if (socket.connected && socket.id) setSelfId(socket.id);

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
      {view === 'home' && (
        <HomeScreen
          onJoined={(r, id) => {
            setRoom(r);
            setSelfId(id);
            setForceConfig(r.phase === 'config');
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
