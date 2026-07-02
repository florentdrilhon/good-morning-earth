import { chat, type ChatMessage } from "./ollama";
import { TOOL_DEFS, dispatch } from "./tools";
import { PERSONA } from "./persona";
import { profileSection } from "./profile";

const MAX_ITERATIONS = 8;

/**
 * Borne l'historique aux ~max derniers messages, coupé à une frontière `user`
 * pour ne jamais orpheliner un `tool` de son message `tool_calls`. La persona
 * est réinjectée par appel, donc l'éviction du plus ancien reste sûre.
 */
export function trimHistory(history: ChatMessage[], max = 40): ChatMessage[] {
  if (history.length <= max) return history;
  let start = history.length - max;
  while (start < history.length && history[start].role !== "user") start++;
  // Aucun message user dans la fenêtre : garder le dernier tour user complet.
  if (start === history.length) {
    start = history.length;
    while (start > 0 && history[start - 1].role !== "user") start--;
    if (start > 0) start--;
  }
  return history.slice(start);
}

export async function runAgent(history: ChatMessage[]): Promise<ChatMessage[]> {
  history = trimHistory(history);
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const msg = await chat([{ role: "system", content: PERSONA + profileSection() }, ...history], TOOL_DEFS);
    history.push(msg);
    if (!msg.tool_calls?.length) return history;
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        // arguments illisibles : l'outil recevra {} et le dira au modèle
      }
      const result = await dispatch(tc.function.name, args);
      history.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }
  history.push({ role: "assistant", content: "Je m'égare dans ma discothèque… reformule ta demande ?" });
  return history;
}
