import type { PlaybackState } from "../spotify/types";

export const RELAUNCH_DIRECTIVE =
  "[Directive automatique] La lecture s'est arrêtée — règle d'or : la musique ne s'arrête jamais. Relance immédiatement : appuie-toi sur l'ambiance des derniers morceaux joués et le profil de l'auditeur, mets 2-3 morceaux en file et lance la lecture (rien ne joue, play_track est autorisé). Puis annonce en une phrase ce que tu relances.";

// ponytail: plafond — un auditeur qui met pause pile à 0ms déclenche une relance. Acceptable.
export function shouldRelaunch(state: PlaybackState | null, wasPlaying: boolean): boolean {
  if (!wasPlaying) return false;
  return state === null || state.track === null || (!state.isPlaying && state.progressMs === 0);
}
