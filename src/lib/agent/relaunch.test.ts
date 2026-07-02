import { describe, it, expect } from "vitest";
import { shouldRelaunch } from "./relaunch";
import type { PlaybackState } from "../spotify/types";

const state = (isPlaying: boolean, progressMs: number): PlaybackState => ({
  track: { uri: "spotify:track:x", name: "x", artists: "y", albumName: "", albumArt: null, durationMs: 0 },
  isPlaying,
  progressMs,
  volumePercent: 50,
});

describe("shouldRelaunch", () => {
  it("relance quand l'état est null après lecture", () => {
    expect(shouldRelaunch(null, true)).toBe(true);
  });

  it("relance quand la lecture s'arrête à 0ms après lecture", () => {
    expect(shouldRelaunch(state(false, 0), true)).toBe(true);
  });

  it("ne relance pas sur pause en plein morceau", () => {
    expect(shouldRelaunch(state(false, 42_000), true)).toBe(false);
  });

  it("ne relance pas quand ça joue encore", () => {
    expect(shouldRelaunch(state(true, 42_000), true)).toBe(false);
  });
});
