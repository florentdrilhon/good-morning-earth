import type { PlaybackState, Track } from "../spotify/types";

export type LastTrackChange = { previous: Track | null; at: number };

const GRACE_MS = 10_000;

/** Contexte horodaté du morceau visé par un message auditeur, avec fenêtre de grâce (temps de frappe). */
export function buildMessageContext(playback: PlaybackState | null, lastChange: LastTrackChange | null, now: number): string {
  const track = playback?.track;
  if (!track) return "";
  const status = playback!.isPlaying ? "joue" : "est en pause";
  const position = Math.round(playback!.progressMs / 1000);
  let grace = "";
  if (lastChange?.previous && now - lastChange.at < GRACE_MS) {
    grace = ` Attention : le morceau a changé il y a moins de 10 s — le message peut concerner le précédent, "${lastChange.previous.name}" de ${lastChange.previous.artists}.`;
  }
  return `[Contexte automatique — à l'envoi de ce message, "${track.name}" de ${track.artists} ${status} (position ${position}s).${grace}]`;
}
