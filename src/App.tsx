import { useEffect, useState } from "react";
import { login } from "./lib/spotify/login";
import { loadStoredTokens, isAuthenticated } from "./lib/spotify/auth";
import { getPlaybackState, pause, resume, ensureActiveDevice } from "./lib/spotify/client";
import type { PlaybackState } from "./lib/spotify/types";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredTokens().then((ok) => setAuthed(ok));
  }, []);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => getPlaybackState().then(setState).catch((e) => setError(String(e))), 3000);
    return () => clearInterval(id);
  }, [authed]);

  const run = (fn: () => Promise<unknown>) => () =>
    ensureActiveDevice().then(fn).then(() => setError(null)).catch((e) => setError(String(e)));

  if (!authed)
    return <button onClick={() => login().then(() => setAuthed(isAuthenticated()))}>Se connecter à Spotify</button>;

  return (
    <main>
      <p>{state?.track ? `${state.track.name} — ${state.track.artists}` : "Rien ne joue"}</p>
      <button onClick={run(state?.isPlaying ? pause : resume)}>{state?.isPlaying ? "Pause" : "Play"}</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
