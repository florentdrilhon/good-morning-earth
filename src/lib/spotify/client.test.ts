import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock("./auth", () => ({ getAccessToken: vi.fn().mockResolvedValue("TOKEN") }));

import { getPlaybackState, pause, searchTracks, addToQueue } from "./client";

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
  for (const r of responses) fn.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => "", ...r });
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
