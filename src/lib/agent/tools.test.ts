import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../spotify/client", () => ({
  searchTracks: vi.fn().mockResolvedValue([
    { uri: "spotify:track:1", name: "So What", artists: "Miles Davis", albumName: "Kind of Blue", albumArt: null, durationMs: 1 },
  ]),
  addToQueue: vi.fn().mockResolvedValue(null),
  ensureActiveDevice: vi.fn().mockResolvedValue(undefined),
  playTrack: vi.fn(), pause: vi.fn(), resume: vi.fn(), skipNext: vi.fn(), setVolume: vi.fn(),
  getPlaybackState: vi.fn(), getQueue: vi.fn(), getPlaylists: vi.fn(), getPlaylistTracks: vi.fn(),
  getLikedTracks: vi.fn(), saveTrack: vi.fn(), addToPlaylist: vi.fn(), trackIdFromUri: (u: string) => u.split(":").pop(),
}));
vi.mock("../lastfm", () => ({ similarArtists: vi.fn(), similarTracks: vi.fn(), topTags: vi.fn(), tagTopArtists: vi.fn(), tagTopTracks: vi.fn() }));

import { TOOL_DEFS, dispatch } from "./tools";
import { addToQueue, ensureActiveDevice, getPlaybackState, playTrack } from "../spotify/client";

describe("tools", () => {
  it("expose chaque outil avec un schéma valide", () => {
    expect(TOOL_DEFS).toHaveLength(19);
    for (const t of TOOL_DEFS) {
      expect(t.type).toBe("function");
      expect(t.function.name).toMatch(/^[a-z_]+$/);
      expect(t.function.description.length).toBeGreaterThan(10);
    }
  });

  it("search_spotify retourne des tracks compacts avec URIs", async () => {
    const out = JSON.parse(await dispatch("search_spotify", { query: "so what" }));
    expect(out[0]).toEqual({ uri: "spotify:track:1", name: "So What", artists: "Miles Davis", album: "Kind of Blue" });
  });

  it("add_to_queue garantit un device actif puis ajoute", async () => {
    await dispatch("add_to_queue", { uri: "spotify:track:1" });
    expect(ensureActiveDevice).toHaveBeenCalled();
    expect(addToQueue).toHaveBeenCalledWith("spotify:track:1");
  });

  it("play_track refuse de couper un morceau en cours", async () => {
    vi.mocked(getPlaybackState).mockResolvedValue({ track: null, isPlaying: true, progressMs: 0, volumePercent: 50 });
    const out = await dispatch("play_track", { uri: "spotify:track:1" });
    expect(out).toContain("je ne coupe jamais la musique");
    expect(playTrack).not.toHaveBeenCalled();
  });

  it("play_track joue quand rien ne joue", async () => {
    vi.mocked(getPlaybackState).mockResolvedValue(null);
    await dispatch("play_track", { uri: "spotify:track:1" });
    expect(playTrack).toHaveBeenCalledWith("spotify:track:1");
  });

  it("outil inconnu → message d'erreur, pas d'exception", async () => {
    expect(await dispatch("nope", {})).toContain("Outil inconnu");
  });
});
