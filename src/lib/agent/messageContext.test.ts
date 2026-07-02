import { describe, it, expect } from "vitest";
import { buildMessageContext } from "./messageContext";
import type { PlaybackState, Track } from "../spotify/types";

const track = (name: string, artists: string): Track => ({ uri: `spotify:track:${name}`, name, artists, albumName: "", albumArt: null, durationMs: 0 });
const playing = (t: Track, isPlaying = true, progressMs = 42_000): PlaybackState => ({ track: t, isPlaying, progressMs, volumePercent: 50 });

describe("buildMessageContext", () => {
  it("retourne vide sans morceau", () => {
    expect(buildMessageContext({ track: null, isPlaying: false, progressMs: 0, volumePercent: 0 }, null, 0)).toBe("");
    expect(buildMessageContext(null, null, 0)).toBe("");
  });

  it("décrit le morceau en cours sans changement récent", () => {
    const out = buildMessageContext(playing(track("So What", "Miles Davis")), null, 0);
    expect(out).toBe('[Contexte automatique — à l\'envoi de ce message, "So What" de Miles Davis joue (position 42s).]');
  });

  it("signale le morceau précédent dans la fenêtre de grâce", () => {
    const out = buildMessageContext(playing(track("Blue in Green", "Miles Davis"), true, 3_000), { previous: track("So What", "Miles Davis"), at: 1_000 }, 6_000);
    expect(out).toContain("changé il y a moins de 10 s");
    expect(out).toContain('le précédent, "So What" de Miles Davis');
  });

  it("ignore un changement hors fenêtre de grâce", () => {
    const out = buildMessageContext(playing(track("Blue in Green", "Miles Davis")), { previous: track("So What", "Miles Davis"), at: 0 }, 11_000);
    expect(out).not.toContain("le précédent");
  });
});
