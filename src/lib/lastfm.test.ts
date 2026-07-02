import { it, expect, vi, afterEach } from "vitest";
import { similarArtists, tagTopArtists, tagTopTracks } from "./lastfm";

afterEach(() => vi.unstubAllGlobals());

it("retourne les noms d'artistes similaires", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ similarartists: { artist: [{ name: "John Coltrane" }, { name: "Bill Evans" }] } }),
  }));
  expect(await similarArtists("Miles Davis")).toEqual(["John Coltrane", "Bill Evans"]);
  const url = (fetch as any).mock.calls[0][0] as string;
  expect(url).toContain("method=artist.getsimilar");
  expect(url).toContain("artist=Miles+Davis");
});

it("retourne les artistes majeurs d'un tag", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ topartists: { artist: [{ name: "Vibrasphere" }, { name: "Symbolic" }] } }),
  }));
  expect(await tagTopArtists("progressive psytrance")).toEqual(["Vibrasphere", "Symbolic"]);
  const url = (fetch as any).mock.calls[0][0] as string;
  expect(url).toContain("method=tag.gettopartists");
});

it("retourne les morceaux emblématiques d'un tag", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tracks: { track: [{ name: "Ceres", artist: { name: "Vibrasphere" } }] } }),
  }));
  expect(await tagTopTracks("progressive psytrance")).toEqual([{ artist: "Vibrasphere", name: "Ceres" }]);
  const url = (fetch as any).mock.calls[0][0] as string;
  expect(url).toContain("method=tag.gettoptracks");
});
