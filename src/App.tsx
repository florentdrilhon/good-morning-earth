import { useEffect, useState } from "react";
import { login } from "./lib/spotify/login";
import { loadStoredTokens, isAuthenticated } from "./lib/spotify/auth";
import { startPoller } from "./lib/spotify/poller";
import type { PlaybackState } from "./lib/spotify/types";
import { Player } from "./components/Player";
import { Library } from "./components/Library";
import { Chat } from "./components/Chat";
import { useComte } from "./hooks/useComte";
import "./App.css";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const { messages, busy, send } = useComte();

  useEffect(() => {
    loadStoredTokens().then(setAuthed);
  }, []);

  useEffect(() => {
    if (!authed) return;
    return startPoller({ onState: setPlayback, onTrackChange: () => {} });
  }, [authed]);

  if (!authed)
    return (
      <div className="login-screen">
        <h1 className="login-title">Good Morning Earth</h1>
        <button
          className="login-button"
          onClick={() => login().then(() => setAuthed(isAuthenticated()))}
        >
          Se connecter à Spotify
        </button>
      </div>
    );

  return (
    <div className="layout">
      <aside className="zone-library">
        <Library />
      </aside>
      <section className="zone-chat">
        <Chat messages={messages} busy={busy} onSend={send} />
      </section>
      <Player state={playback} />
    </div>
  );
}
