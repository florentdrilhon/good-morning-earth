import { chat } from "./ollama";
import { PERSONA } from "./persona";
import type { Track } from "../spotify/types";

export async function announceTrack(track: Track, previous: Track | null): Promise<string> {
  const msg = await chat(
    [
      { role: "system", content: PERSONA },
      {
        role: "user",
        content:
          `[ANTENNE] "${track.name}" de ${track.artists} démarre` +
          (previous ? ` juste après "${previous.name}" de ${previous.artists}` : "") +
          `. Fais une intervention d'antenne de 2-3 phrases maximum : anecdote, contexte ou transition. ` +
          `Rien d'inventé — si tu ne sais rien de sûr sur ce morceau, parle de l'ambiance. Pas de question à l'auditeur.`,
      },
    ],
    [], // pas d'outils : intervention pure, rapide
  );
  return msg.content ?? "";
}
