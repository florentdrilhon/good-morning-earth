import { it, expect, vi, afterEach } from "vitest";
import { chat, OllamaDownError } from "./ollama";

afterEach(() => vi.unstubAllGlobals());

it("appelle l'endpoint OpenAI-compatible et retourne le message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { role: "assistant", content: "Bonsoir." } }] }),
  }));
  const msg = await chat([{ role: "user", content: "salut" }], []);
  expect(msg.content).toBe("Bonsoir.");
  const [url, init] = (fetch as any).mock.calls[0];
  expect(url).toBe("http://localhost:11434/v1/chat/completions");
  const body = JSON.parse(init.body);
  expect(body.messages).toEqual([{ role: "user", content: "salut" }]);
  expect(body.stream).toBe(false);
  expect(body.tools).toBeUndefined();
});

it("lève OllamaDownError si Ollama ne répond pas", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(chat([], [])).rejects.toBeInstanceOf(OllamaDownError);
});
