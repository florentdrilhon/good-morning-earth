import { chat, type ChatMessage } from "./ollama";
import { TOOL_DEFS, dispatch } from "./tools";
import { PERSONA } from "./persona";

const MAX_ITERATIONS = 8;

export async function runAgent(history: ChatMessage[]): Promise<ChatMessage[]> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const msg = await chat([{ role: "system", content: PERSONA }, ...history], TOOL_DEFS);
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
