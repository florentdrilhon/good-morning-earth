import { useRef, useState } from "react";
import { runAgent } from "../lib/agent/loop";
import { OllamaDownError, type ChatMessage } from "../lib/agent/ollama";
import type { UiMessage } from "../components/Chat";

export function useComte() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const history = useRef<ChatMessage[]>([]);

  const pushComte = (text: string) => {
    history.current.push({ role: "assistant", content: text });
    setMessages((m) => [...m, { role: "comte", text }]);
  };

  const send = async (text: string) => {
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    history.current.push({ role: "user", content: text });
    try {
      history.current = await runAgent(history.current);
      const last = history.current[history.current.length - 1];
      setMessages((m) => [...m, { role: "comte", text: last?.content ?? "…" }]);
    } catch (e) {
      const text = e instanceof OllamaDownError ? e.message : `Petit souci technique : ${e}`;
      setMessages((m) => [...m, { role: "comte", text }]);
    } finally {
      setBusy(false);
    }
  };

  return { messages, busy, send, pushComte };
}
