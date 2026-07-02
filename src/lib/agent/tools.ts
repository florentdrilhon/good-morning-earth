import * as sp from "../spotify/client";
import * as fm from "../lastfm";
import type { Track } from "../spotify/types";
import type { ToolDef } from "./ollama";

const slim = (tracks: Track[]) =>
  tracks.map((t) => ({ uri: t.uri, name: t.name, artists: t.artists, album: t.albumName }));

const str = { type: "string" } as const;
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolDef => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOL_DEFS: ToolDef[] = [
  tool("search_spotify", "Recherche des morceaux sur Spotify. Retourne nom, artistes, album et URI. TOUJOURS utiliser cet outil pour obtenir une URI avant de jouer ou mettre en file un morceau.", { query: str }, ["query"]),
  tool("play_track", "Joue immédiatement un morceau (URI issue de search_spotify).", { uri: str }, ["uri"]),
  tool("add_to_queue", "Ajoute un morceau à la file d'attente (URI issue de search_spotify). La file est append-only : ajoute 2-3 morceaux d'avance maximum.", { uri: str }, ["uri"]),
  tool("get_playback_state", "État actuel : morceau en cours, lecture/pause, volume."),
  tool("get_queue", "Liste les prochains morceaux de la file d'attente."),
  tool("pause", "Met la lecture en pause."),
  tool("resume", "Relance la lecture."),
  tool("skip", "Passe au morceau suivant."),
  tool("set_volume", "Règle le volume (0-100).", { percent: { type: "number" } }, ["percent"]),
  tool("get_playlists", "Liste les playlists de l'auditeur."),
  tool("get_playlist_tracks", "Liste les morceaux d'une playlist (id issu de get_playlists).", { playlist_id: str }, ["playlist_id"]),
  tool("get_liked_tracks", "Liste les derniers titres likés de l'auditeur — sa base de goûts."),
  tool("save_track", "Like un morceau pour l'auditeur (URI issue d'une recherche ou de l'état de lecture).", { uri: str }, ["uri"]),
  tool("add_to_playlist", "Ajoute un morceau à une playlist de l'auditeur.", { playlist_id: str, uri: str }, ["playlist_id", "uri"]),
  tool("lastfm_similar_artists", "Artistes proches d'un artiste donné (données d'écoute réelles Last.fm).", { artist: str }, ["artist"]),
  tool("lastfm_similar_tracks", "Morceaux proches d'un morceau donné (Last.fm).", { artist: str, track: str }, ["artist", "track"]),
  tool("lastfm_tags", "Genres/tags principaux d'un artiste (Last.fm).", { artist: str }, ["artist"]),
];

export async function dispatch(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "search_spotify": return JSON.stringify(slim(await sp.searchTracks(args.query)));
      case "play_track": await sp.ensureActiveDevice(); await sp.playTrack(args.uri); return "OK, lecture lancée";
      case "add_to_queue": await sp.ensureActiveDevice(); await sp.addToQueue(args.uri); return "OK, ajouté à la file";
      case "get_playback_state": return JSON.stringify(await sp.getPlaybackState());
      case "get_queue": return JSON.stringify(slim(await sp.getQueue()));
      case "pause": await sp.ensureActiveDevice(); await sp.pause(); return "OK";
      case "resume": await sp.ensureActiveDevice(); await sp.resume(); return "OK";
      case "skip": await sp.ensureActiveDevice(); await sp.skipNext(); return "OK";
      case "set_volume": await sp.setVolume(args.percent); return "OK";
      case "get_playlists": return JSON.stringify(await sp.getPlaylists());
      case "get_playlist_tracks": return JSON.stringify(slim(await sp.getPlaylistTracks(args.playlist_id)));
      case "get_liked_tracks": return JSON.stringify(slim(await sp.getLikedTracks(30)));
      case "save_track": await sp.saveTrack(sp.trackIdFromUri(args.uri)); return "OK, liké";
      case "add_to_playlist": await sp.addToPlaylist(args.playlist_id, args.uri); return "OK, ajouté";
      case "lastfm_similar_artists": return JSON.stringify(await fm.similarArtists(args.artist));
      case "lastfm_similar_tracks": return JSON.stringify(await fm.similarTracks(args.artist, args.track));
      case "lastfm_tags": return JSON.stringify(await fm.topTags(args.artist));
      default: return `Outil inconnu: ${name}`;
    }
  } catch (e) {
    return `Erreur outil ${name}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
