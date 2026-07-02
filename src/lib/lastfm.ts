const BASE = "https://ws.audioscrobbler.com/2.0/";
const KEY = import.meta.env.VITE_LASTFM_API_KEY as string;

async function lastfm<T>(params: Record<string, string>): Promise<T> {
  const p = new URLSearchParams({ ...params, api_key: KEY, format: "json" });
  const res = await fetch(`${BASE}?${p}`);
  if (!res.ok) throw new Error(`Last.fm: ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`Last.fm: ${j.message}`);
  return j;
}

export async function similarArtists(artist: string): Promise<string[]> {
  const j = await lastfm<any>({ method: "artist.getsimilar", artist, limit: "10" });
  return (j.similarartists?.artist ?? []).map((a: any) => a.name);
}

export async function similarTracks(artist: string, track: string): Promise<{ artist: string; name: string }[]> {
  const j = await lastfm<any>({ method: "track.getsimilar", artist, track, limit: "10" });
  return (j.similartracks?.track ?? []).map((t: any) => ({ artist: t.artist?.name ?? "", name: t.name }));
}

export async function topTags(artist: string): Promise<string[]> {
  const j = await lastfm<any>({ method: "artist.gettoptags", artist });
  return (j.toptags?.tag ?? []).slice(0, 8).map((t: any) => t.name);
}
