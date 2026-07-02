import { it, expect, vi, afterEach } from "vitest";
import { similarArtists } from "./lastfm";

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
