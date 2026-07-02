import { getPlaybackState } from "./client";
import { AuthExpiredError } from "./auth";
import type { PlaybackState, Track } from "./types";

interface Handlers {
  onState(s: PlaybackState | null): void;
  onTrackChange(track: Track, previous: Track | null): void;
  onAuthLost?(): void;
}

export function startPoller(handlers: Handlers, intervalMs = 3000): () => void {
  let lastTrack: Track | null = null;
  let inFlight = false; // un tick peut dépasser l'intervalle (backoff 429) : pas de course
  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const s = await getPlaybackState();
      handlers.onState(s);
      if (s?.track && s.track.uri !== lastTrack?.uri) {
        handlers.onTrackChange(s.track, lastTrack);
        lastTrack = s.track;
      }
    } catch (e) {
      if (e instanceof AuthExpiredError) handlers.onAuthLost?.();
      // sinon erreur réseau ponctuelle : on retentera au prochain tick
    } finally {
      inFlight = false;
    }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
