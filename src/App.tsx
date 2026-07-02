import { useEffect, useRef, useState } from "react";
import { login } from "./lib/spotify/login";
import { loadStoredTokens, isAuthenticated } from "./lib/spotify/auth";
import { startPoller } from "./lib/spotify/poller";
import { announceTrack } from "./lib/agent/announcer";
import { buildMessageContext, type LastTrackChange } from "./lib/agent/messageContext";
import { OllamaDownError } from "./lib/agent/ollama";
import type { PlaybackState } from "./lib/spotify/types";
import { Player } from "./components/Player";
import { Library } from "./components/Library";
import { Chat } from "./components/Chat";
import { useComte } from "./hooks/useComte";
import "./App.css";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [radioMode, setRadioMode] = useState(true);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { messages, busy, send, pushComte } = useComte();

  const radioModeRef = useRef(radioMode);
  radioModeRef.current = radioMode;
  const ollamaDownNotified = useRef(false);
  const playbackRef = useRef<PlaybackState | null>(null);
  const lastChangeRef = useRef<LastTrackChange | null>(null);

  useEffect(() => {
    loadStoredTokens().then(setAuthed);
  }, []);

  useEffect(() => {
    if (!authed) return;
    return startPoller({
      onState: (state) => {
        playbackRef.current = state;
        setPlayback(state);
      },
      onAuthLost: () => setAuthed(false), // refresh token invalide → retour à l'écran de login
      onTrackChange: (track, previous) => {
        lastChangeRef.current = { previous, at: Date.now() };
        if (!radioModeRef.current || !previous) return; // ref, pas de state stale ; pas d'intervention au premier morceau
        announceTrack(track, previous)
          .then((text) => {
            ollamaDownNotified.current = false;
            pushComte(text);
          })
          .catch((e) => {
            if (e instanceof OllamaDownError && !ollamaDownNotified.current) {
              ollamaDownNotified.current = true;
              pushComte(e.message);
            }
          });
      },
    });
  }, [authed]);

  const handleLogin = () => {
    setLoginError(null);
    setLoginPending(true);
    login()
      .then(() => setAuthed(isAuthenticated()))
      .catch(() => setLoginError("Connexion à Spotify échouée. Réessaie."))
      .finally(() => setLoginPending(false));
  };

  if (!authed)
    return (
      <div className="login-screen">
        <h1 className="login-title">Good Morning Earth</h1>
        <button className="login-button" onClick={handleLogin} disabled={loginPending}>
          Se connecter à Spotify
        </button>
        {loginError && <p className="login-error">{loginError}</p>}
      </div>
    );

  return (
    <div className="layout">
      <aside className="zone-library">
        <Library />
      </aside>
      <section className="zone-chat">
        <Chat
          messages={messages}
          busy={busy}
          onSend={(t) => send(t, buildMessageContext(playbackRef.current, lastChangeRef.current, Date.now()))}
          radioMode={radioMode}
          onToggleRadio={() => setRadioMode((on) => !on)}
        />
      </section>
      <Player state={playback} />
    </div>
  );
}
