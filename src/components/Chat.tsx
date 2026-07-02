import { useEffect, useRef, useState } from "react";

export interface UiMessage {
  role: "user" | "comte";
  text: string;
}

type ChatProps = Readonly<{
  messages: UiMessage[];
  busy: boolean;
  onSend: (text: string) => void;
}>;

export function Chat({ messages, busy, onSend }: ChatProps) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <span className="chat-header-title">Studio — Le Comte</span>
        <span className="chat-onair">● On Air</span>
      </header>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            {m.role === "comte" && <span className="bubble-label">Le Comte</span>}
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="bubble bubble-comte bubble-typing">
            <span className="bubble-label">Le Comte</span>
            Le Comte réfléchit…
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="chat-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Parle au Comte…"
          disabled={busy}
        />
        <button disabled={busy || !draft.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
