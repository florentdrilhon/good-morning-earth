import { it, expect, vi, afterEach } from "vitest";

vi.mock("./client", () => ({ getPlaybackState: vi.fn() }));
import { getPlaybackState } from "./client";
import { startPoller } from "./poller";
import type { PlaybackState } from "./types";

const state = (uri: string): PlaybackState => ({
  track: { uri, name: uri, artists: "A", albumName: "", albumArt: null, durationMs: 1 },
  isPlaying: true,
  progressMs: 0,
  volumePercent: 50,
});

afterEach(() => vi.useRealTimers());

it("émet onTrackChange une seule fois par nouveau morceau", async () => {
  vi.useFakeTimers();
  (getPlaybackState as any)
    .mockResolvedValueOnce(state("t1"))
    .mockResolvedValueOnce(state("t1"))
    .mockResolvedValueOnce(state("t2"));
  const onTrackChange = vi.fn();
  const stop = startPoller({ onState: () => {}, onTrackChange }, 1000);
  for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(1000);
  stop();
  expect(onTrackChange).toHaveBeenCalledTimes(2); // t1 (premier), puis t2
  expect(onTrackChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ uri: "t2" }),
    expect.objectContaining({ uri: "t1" }),
  );
});
