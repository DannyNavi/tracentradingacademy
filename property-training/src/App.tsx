import { useEffect, useRef, useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { BoardPreviewScreen } from './screens/BoardPreviewScreen';
import { ThemeToggle } from './components/ThemeToggle';
import { clearSession, getPlayerId, loadSession, saveSession } from './lib/session';
import { rejoinLobby, socket } from './lib/socket';
import {
  applyTheme,
  resolveTheme,
  saveTheme,
  type ThemeMode,
} from './lib/theme';
import type { RoomState } from './lib/types';
import './App.css';

type View = 'home' | 'lobby' | 'game' | 'preview';

function pathIsPreview() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/preview' || window.location.hash === '#preview';
}

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState(() => getPlayerId());
  const [connected, setConnected] = useState(socket.connected);
  const [rejoining, setRejoining] = useState(() => Boolean(loadSession()) && !pathIsPreview());
  const [preview, setPreview] = useState(() => pathIsPreview());
  const [theme, setTheme] = useState<ThemeMode>(() => resolveTheme());
  const rejoinedRef = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function syncPreviewFromUrl() {
      setPreview(pathIsPreview());
    }
    window.addEventListener('popstate', syncPreviewFromUrl);
    window.addEventListener('hashchange', syncPreviewFromUrl);
    return () => {
      window.removeEventListener('popstate', syncPreviewFromUrl);
      window.removeEventListener('hashchange', syncPreviewFromUrl);
    };
  }, []);

  useEffect(() => {
    if (preview) {
      setRejoining(false);
      return;
    }

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
  }, [preview]);

  function openPreview() {
    window.history.pushState({}, '', '/preview');
    setPreview(true);
  }

  function closePreview() {
    window.history.pushState({}, '', '/');
    setPreview(false);
  }

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    setTheme(next);
  }

  let view: View = 'home';
  if (preview) view = 'preview';
  else if (room) {
    if (room.phase === 'lobby' || room.phase === 'config') view = 'lobby';
    else view = 'game';
  }

  return (
    <div className="app-shell">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {!preview && !connected ? <div className="banner">Connecting to server…</div> : null}
      {!preview && connected && rejoining ? <div className="banner">Rejoining lobby…</div> : null}
      {view === 'preview' && <BoardPreviewScreen onBack={closePreview} />}
      {view === 'home' && !rejoining && (
        <HomeScreen
          onJoined={(r, id) => {
            setRoom(r);
            setSelfId(id);
            saveSession(r.code, id);
          }}
          onPreviewBoard={openPreview}
        />
      )}
      {view === 'lobby' && room && <LobbyScreen room={room} selfId={selfId} />}
      {view === 'game' && room && <GameScreen room={room} selfId={selfId} />}
    </div>
  );
}
