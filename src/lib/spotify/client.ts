import { invoke } from "@tauri-apps/api/core";
import { getAccessToken } from "./auth";
import type { Device, PlaybackState, Playlist, Track } from "./types";

const BASE = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(public status: number, message: string) {
    super(`Spotify ${status}: ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T | null> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 429 && !retried) {
    await sleep(Number(res.headers.get("Retry-After") ?? "1") * 1000);
    return api(path, init, true);
  }
  if (res.status === 204) return null;
  if (!res.ok) throw new SpotifyError(res.status, await res.text());
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null; // Spotify renvoie parfois 200 avec un corps vide

}

export function mapTrack(item: any): Track {
  return {
    uri: item.uri,
    name: item.name,
    artists: item.artists.map((a: any) => a.name).join(", "),
    albumName: item.album?.name ?? "",
    albumArt: item.album?.images?.[0]?.url ?? null,
    durationMs: item.duration_ms,
  };
}

export async function getPlaybackState(): Promise<PlaybackState | null> {
  const raw = await api<any>("/me/player");
  if (!raw) return null;
  return {
    track: raw.item ? mapTrack(raw.item) : null,
    isPlaying: raw.is_playing,
    progressMs: raw.progress_ms ?? 0,
    volumePercent: raw.device?.volume_percent ?? 0,
  };
}

export const pause = () => api("/me/player/pause", { method: "PUT" });
export const resume = () => api("/me/player/play", { method: "PUT" });

export async function getDevices(): Promise<Device[]> {
  const raw = await api<any>("/me/player/devices");
  return raw?.devices ?? [];
}

export const transferPlayback = (deviceId: string) =>
  api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId] }) });

export async function searchTracks(query: string, limit = 8): Promise<Track[]> {
  const p = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const raw = await api<any>(`/search?${p}`);
  return (raw?.tracks?.items ?? []).map(mapTrack);
}

export const addToQueue = (uri: string) =>
  api(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: "POST" });

export async function getQueue(): Promise<Track[]> {
  const raw = await api<any>("/me/player/queue");
  return (raw?.queue ?? []).map(mapTrack);
}

export const playTrack = (uri: string) =>
  api("/me/player/play", { method: "PUT", body: JSON.stringify({ uris: [uri] }) });

export const skipNext = () => api("/me/player/next", { method: "POST" });
export const skipPrevious = () => api("/me/player/previous", { method: "POST" });
export const setVolume = (percent: number) =>
  api(`/me/player/volume?volume_percent=${Math.round(percent)}`, { method: "PUT" });

export async function getPlaylists(): Promise<Playlist[]> {
  const raw = await api<any>("/me/playlists?limit=50");
  return (raw?.items ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    trackCount: p.tracks?.total ?? 0,
    image: p.images?.[0]?.url ?? null,
  }));
}

export async function getPlaylistTracks(id: string): Promise<Track[]> {
  const raw = await api<any>(`/playlists/${id}/tracks?limit=100`);
  return (raw?.items ?? []).filter((i: any) => i.track).map((i: any) => mapTrack(i.track));
}

export async function getLikedTracks(limit = 50): Promise<Track[]> {
  const raw = await api<any>(`/me/tracks?limit=${limit}`);
  return (raw?.items ?? []).map((i: any) => mapTrack(i.track));
}

export const trackIdFromUri = (uri: string) => uri.split(":").pop() ?? uri;

export const saveTrack = (trackId: string) =>
  api(`/me/tracks?ids=${trackId}`, { method: "PUT" });

export const addToPlaylist = (playlistId: string, uri: string) =>
  api(`/playlists/${playlistId}/tracks`, { method: "POST", body: JSON.stringify({ uris: [uri] }) });

export async function ensureActiveDevice(): Promise<void> {
  let devices = await getDevices();
  if (devices.some((d) => d.is_active)) return;
  let local = devices.find((d) => d.type === "Computer");
  if (!local) {
    await invoke("launch_spotify");
    for (let i = 0; i < 10 && !local; i++) {
      await sleep(1000);
      devices = await getDevices();
      local = devices.find((d) => d.type === "Computer");
    }
  }
  if (!local) throw new Error("Spotify introuvable sur ce Mac — lance l'app Spotify et réessaie.");
  await transferPlayback(local.id);
  // Le transfert est asynchrone côté Spotify : on attend que le device soit bien actif
  // avant de rendre la main, sinon la commande suivante 404 (NO_ACTIVE_DEVICE).
  for (let i = 0; i < 10; i++) {
    if ((await getDevices()).some((d) => d.id === local!.id && d.is_active)) return;
    await sleep(500);
  }
  throw new Error("Spotify n'a pas activé le device — lance l'app Spotify et réessaie.");
}
