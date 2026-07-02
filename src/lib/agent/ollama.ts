const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";
const MODEL = (import.meta.env.VITE_OLLAMA_MODEL as string) || "qwen3:14b";

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  };
}

export class OllamaDownError extends Error {
  constructor() {
    super("Ollama ne répond pas. Lance-le avec : brew services start ollama");
  }
}

export async function chat(messages: ChatMessage[], tools: ToolDef[]): Promise<ChatMessage> {
  let res: Response;
  try {
    res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, tools: tools.length ? tools : undefined, stream: false }),
      signal: AbortSignal.timeout(120_000), // Ollama figé : abort → OllamaDownError, pas de chat bloqué à vie
    });
  } catch {
    throw new OllamaDownError(); // couvre réseau + abort/timeout
  }
  if (!res.ok) throw new Error(`Ollama: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.choices[0].message;
}
