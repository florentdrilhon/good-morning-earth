import { getTopArtists, getTopTracks } from "../spotify/client";
import type { Track } from "../spotify/types";

const CACHE_KEY = "gme-listener-profile";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const BOUSSOLE =
  "Ce profil est ta boussole, PAS ta prison : il calibre tes choix et tes découvertes. " +
  "Ta mission inclut d'emmener l'auditeur là où il n'est jamais allé — en partant de là où il vit.";

type ProfileInput = {
  longTermArtists: { name: string; genres: string[] }[];
  shortTermArtists: { name: string; genres: string[] }[];
  topTracks: Track[];
};

function topGenres(artists: { genres: string[] }[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const a of artists) for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([g]) => g);
}

export function formatProfile(input: ProfileInput): string {
  const genres = topGenres([...input.longTermArtists, ...input.shortTermArtists], 8);
  const background = input.longTermArtists.slice(0, 15).map((a) => a.name);
  const obsessions = input.shortTermArtists.slice(0, 8).map((a) => a.name);
  const tracks = input.topTracks.slice(0, 10).map((t) => `${t.name} — ${t.artists}`);

  const lines = [
    genres.length && `- Genres dominants : ${genres.join(", ")}`,
    background.length && `- Artistes de fond (long terme) : ${background.join(", ")}`,
    obsessions.length && `- Obsessions du moment (4 dernières semaines) : ${obsessions.join(", ")}`,
    tracks.length && `- Morceaux marquants : ${tracks.join(", ")}`,
  ].filter(Boolean);
  if (!lines.length) return "";

  return `PROFIL DE L'AUDITEUR (stats d'écoute Spotify réelles) :\n${lines.join("\n")}\n${BOUSSOLE}`;
}

let profileText = "";

export function profileSection(): string {
  return profileText ? "\n\n" + profileText : "";
}

export async function initListenerProfile(): Promise<void> {
  const hasStorage = typeof localStorage !== "undefined";
  if (hasStorage) {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as { builtAt: number; text: string };
        if (Date.now() - cached.builtAt < MAX_AGE_MS) {
          profileText = cached.text;
          return;
        }
      } catch {
        // cache illisible : on rebâtit
      }
    }
  }

  const [longTermArtists, shortTermArtists, topTracks] = await Promise.all([
    getTopArtists("long_term", 20),
    getTopArtists("short_term", 10),
    getTopTracks("medium_term", 15),
  ]);
  profileText = formatProfile({ longTermArtists, shortTermArtists, topTracks });

  if (hasStorage) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ builtAt: Date.now(), text: profileText }));
  }
}
