import { useEffect, useRef, useState } from "react";
import {
  getPlaylists,
  getPlaylistTracks,
  getLikedTracks,
  searchTracks,
  playTrack,
  addToQueue,
  saveTrack,
  trackIdFromUri,
  ensureActiveDevice,
} from "../lib/spotify/client";
import type { Playlist, Track } from "../lib/spotify/types";

const LIKED = "__liked__";

export function Library() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [heading, setHeading] = useState("Titres likés");
  const [selected, setSelected] = useState<string>(LIKED);
  const [query, setQuery] = useState("");
  // compteur de requêtes : seule la dernière sélection a le droit d'écrire tracks
  const reqRef = useRef(0);

  const loadTracks = (load: Promise<Track[]>) => {
    const req = ++reqRef.current;
    load.then((t) => {
      if (reqRef.current === req) setTracks(t);
    }).catch(console.error);
  };

  useEffect(() => {
    getPlaylists().then(setPlaylists).catch(console.error);
    loadTracks(getLikedTracks());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (id: string, label: string, load: Promise<Track[]>) => {
    setSelected(id);
    setHeading(label);
    loadTracks(load);
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) show("", `Résultats : ${q}`, searchTracks(q));
  };

  const play = (uri: string) =>
    ensureActiveDevice().then(() => playTrack(uri)).catch(console.error);

  return (
    <div className="library">
      <form className="library-search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          aria-label="Rechercher un titre"
        />
      </form>

      <nav className="library-nav">
        <button
          className={`library-nav-item is-liked${selected === LIKED ? " is-active" : ""}`}
          onClick={() => show(LIKED, "Titres likés", getLikedTracks())}
        >
          ♥ Titres likés
        </button>
        <p className="library-label">Bibliothèque</p>
        {playlists.map((p) => (
          <button
            key={p.id}
            className={`library-nav-item${selected === p.id ? " is-active" : ""}`}
            onClick={() => show(p.id, p.name, getPlaylistTracks(p.id))}
          >
            {p.name}
          </button>
        ))}
      </nav>

      <p className="library-label library-heading">{heading}</p>
      <ul className="track-list">
        {tracks.map((t) => (
          <li key={t.uri} className="track">
            <button
              className="track-name"
              onClick={() => play(t.uri)}
              title={`${t.name} — ${t.artists}`}
            >
              <span className="track-title">{t.name}</span>
              <span className="track-artists">{t.artists}</span>
            </button>
            <button className="track-action" title="Ajouter à la file" onClick={() => addToQueue(t.uri).catch(console.error)}>
              ＋
            </button>
            <button className="track-action" title="Liker" onClick={() => saveTrack(trackIdFromUri(t.uri)).catch(console.error)}>
              ♥
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
