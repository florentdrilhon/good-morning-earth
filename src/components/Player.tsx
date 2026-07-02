import type { PlaybackState } from "../lib/spotify/types";
import {
  pause,
  resume,
  skipNext,
  skipPrevious,
  setVolume,
  ensureActiveDevice,
} from "../lib/spotify/client";

type PlayerProps = Readonly<{ state: PlaybackState | null }>;

export function Player({ state }: PlayerProps) {
  const run = (fn: () => Promise<unknown>) => () =>
    ensureActiveDevice().then(fn).catch(console.error);
  const track = state?.track;
  const isPlaying = state?.isPlaying ?? false;

  return (
    <footer className="player">
      <div className="player-art">
        {track?.albumArt ? (
          <img src={track.albumArt} alt="" />
        ) : (
          <span className="player-art-glyph" aria-hidden>
            ⏺
          </span>
        )}
      </div>

      <div className="player-info">
        <div className="player-title">{track?.name ?? "Rien ne joue"}</div>
        <div className="player-meta">
          <span className="player-artists">{track?.artists ?? "—"}</span>
          {isPlaying && (
            <span className="player-vu" aria-hidden>
              <i /><i /><i /><i /><i /><i />
            </span>
          )}
        </div>
      </div>

      <div className="player-controls">
        <button className="player-btn" onClick={run(skipPrevious)} aria-label="Précédent">
          ⏮
        </button>
        <button
          className="player-btn player-btn-play"
          onClick={run(isPlaying ? pause : resume)}
          aria-label={isPlaying ? "Pause" : "Lecture"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="player-btn" onClick={run(skipNext)} aria-label="Suivant">
          ⏭
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        defaultValue={state?.volumePercent ?? 50}
        onChange={(e) => setVolume(Number(e.target.value)).catch(console.error)}
        className="player-volume"
        aria-label="Volume"
      />
    </footer>
  );
}
