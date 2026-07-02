import { describe, it, expect } from "vitest";
import { formatProfile } from "./profile";
import type { Track } from "../spotify/types";

const artist = (name: string, genres: string[] = []) => ({ name, genres });
const track = (name: string, artists: string): Track => ({
  uri: `spotify:track:${name}`,
  name,
  artists,
  albumName: "",
  albumArt: null,
  durationMs: 0,
});

describe("formatProfile", () => {
  it("classe les genres par fréquence, tous artistes confondus", () => {
    const text = formatProfile({
      longTermArtists: [artist("A", ["techno", "house"]), artist("B", ["techno"])],
      shortTermArtists: [artist("C", ["techno", "ambient"])],
      topTracks: [],
    });
    // techno (3) devant house (1) et ambient (1)
    expect(text).toContain("Genres dominants : techno");
    expect(text.indexOf("techno")).toBeLessThan(text.indexOf("house"));
  });

  it("respecte les plafonds (15 fond, 8 obsessions, 8 genres, 10 morceaux)", () => {
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => artist(`${prefix}${i}`, [`g${i}`]));
    const text = formatProfile({
      longTermArtists: many(20, "L"),
      shortTermArtists: many(20, "S"),
      topTracks: Array.from({ length: 20 }, (_, i) => track(`T${i}`, "artiste")),
    });
    const line = (label: string) => text.split("\n").find((l) => l.startsWith(label)) ?? "";
    expect(line("- Genres dominants").split(",").length).toBe(8);
    expect(line("- Artistes de fond").split(",").length).toBe(15);
    expect(line("- Obsessions du moment").split(",").length).toBe(8);
    expect(line("- Morceaux marquants").split(",").length).toBe(10);
  });

  it("retourne \"\" quand tout est vide", () => {
    expect(formatProfile({ longTermArtists: [], shortTermArtists: [], topTracks: [] })).toBe("");
  });

  it("omet une ligne vide (pas de genres)", () => {
    const text = formatProfile({
      longTermArtists: [artist("A")],
      shortTermArtists: [],
      topTracks: [],
    });
    expect(text).not.toContain("Genres dominants");
    expect(text).toContain("Artistes de fond (long terme) : A");
  });
});
