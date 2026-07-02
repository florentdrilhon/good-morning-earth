import { getPlaybackState } from "./client";
import type { PlaybackState, Track } from "./types";

interface Handlers {
  onState(s: PlaybackState | null): void;
  onTrackChange(track: Track, previous: Track | null): void;
}

export function startPoller(handlers: Handlers, intervalMs = 3000): () => void {
  let lastTrack: Track | null = null;
  const tick = async () => {
    try {
      const s = await getPlaybackState();
      handlers.onState(s);
      if (s?.track && s.track.uri !== lastTrack?.uri) {
        handlers.onTrackChange(s.track, lastTrack);
        lastTrack = s.track;
      }
    } catch {
      // erreur réseau ponctuelle : on retentera au prochain tick
    }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
