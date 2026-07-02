import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock("./auth", () => ({ getAccessToken: vi.fn().mockResolvedValue("TOKEN") }));

import { getPlaybackState, pause, searchTracks, addToQueue, getPlaylists, trackIdFromUri, saveTrack, ensureActiveDevice } from "./client";

const rawState = {
  is_playing: true,
  progress_ms: 1000,
  device: { volume_percent: 50 },
  item: {
    uri: "spotify:track:1",
    name: "So What",
    artists: [{ name: "Miles Davis" }],
    album: { name: "Kind of Blue", images: [{ url: "http://img" }] },
    duration_ms: 545000,
  },
};

function mockFetch(...responses: Array<Partial<Response>>) {
  const fn = vi.fn();
  for (const r of responses) {
    // api() lit désormais res.text() : sérialiser le json fourni pour rester compatible
    const text = r.text ?? (r.json ? async () => JSON.stringify(await (r.json as any)()) : async () => "");
    fn.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), ...r, text });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("client", () => {
  it("mappe l'état de lecture", async () => {
    mockFetch({ json: async () => rawState });
    const s = await getPlaybackState();
    expect(s?.track).toEqual({
      uri: "spotify:track:1",
      name: "So What",
      artists: "Miles Davis",
      albumName: "Kind of Blue",
      albumArt: "http://img",
      durationMs: 545000,
    });
    expect(s?.isPlaying).toBe(true);
    expect(s?.volumePercent).toBe(50);
  });

  it("retourne null si rien ne joue (204)", async () => {
    mockFetch({ status: 204 });
    expect(await getPlaybackState()).toBeNull();
  });

  it("envoie le Bearer token et retente une fois sur 429", async () => {
    const f = mockFetch(
      { ok: false, status: 429, headers: new Headers({ "Retry-After": "0" }) },
      { status: 204 },
    );
    await pause();
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer TOKEN");
  });

  it("tolère un corps vide sur un 200", async () => {
    mockFetch({ status: 200, text: async () => "" });
    await expect(pause()).resolves.not.toThrow();
  });
});

describe("ensureActiveDevice", () => {
  const devices = (...list: Array<Partial<import("./types").Device>>) => ({
    json: async () => ({ devices: list }),
  });

  it("attend que le device transféré soit actif", async () => {
    vi.useFakeTimers();
    const f = mockFetch(
      devices({ id: "c1", type: "Computer", is_active: false }),
      { status: 204 }, // transferPlayback
      devices({ id: "c1", type: "Computer", is_active: false }),
      devices({ id: "c1", type: "Computer", is_active: true }),
    );
    const p = ensureActiveDevice();
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

describe("recherche et queue", () => {
  it("mappe les résultats de recherche", async () => {
    mockFetch({ json: async () => ({ tracks: { items: [rawState.item] } }) });
    const tracks = await searchTracks("so what");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].uri).toBe("spotify:track:1");
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("q=so+what");
    expect(url).toContain("type=track");
    expect(url).toContain("limit=8");
  });

  it("encode l'URI dans l'ajout à la queue", async () => {
    const f = mockFetch({ status: 204 });
    await addToQueue("spotify:track:1");
    expect(f.mock.calls[0][0]).toContain(`uri=${encodeURIComponent("spotify:track:1")}`);
    expect(f.mock.calls[0][1].method).toBe("POST");
  });
});

describe("bibliothèque", () => {
  it("mappe les playlists", async () => {
    mockFetch({
      json: async () => ({
        items: [{ id: "p1", name: "Jazz", tracks: { total: 12 }, images: [{ url: "http://i" }] }],
      }),
    });
    expect(await getPlaylists()).toEqual([{ id: "p1", name: "Jazz", trackCount: 12, image: "http://i" }]);
  });

  it("extrait l'id d'une URI et sauvegarde", async () => {
    expect(trackIdFromUri("spotify:track:abc123")).toBe("abc123");
    const f = mockFetch({ status: 204 });
    await saveTrack("abc123");
    expect(f.mock.calls[0][0]).toContain("/me/tracks?ids=abc123");
    expect(f.mock.calls[0][1].method).toBe("PUT");
  });
});
