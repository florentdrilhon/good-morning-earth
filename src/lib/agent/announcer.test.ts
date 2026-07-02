import { it, expect, vi } from "vitest";

vi.mock("./ollama", () => ({ chat: vi.fn().mockResolvedValue({ role: "assistant", content: "Quel morceau !" }) }));
import { chat } from "./ollama";
import { announceTrack } from "./announcer";

const track = (name: string) => ({ uri: `u:${name}`, name, artists: "Miles Davis", albumName: "", albumArt: null, durationMs: 1 });

it("construit le prompt d'antenne avec morceau courant et précédent, sans outils", async () => {
  const text = await announceTrack(track("So What"), track("Blue in Green"));
  expect(text).toBe("Quel morceau !");
  const [messages, tools] = (chat as any).mock.calls[0];
  expect(tools).toEqual([]);
  const prompt = messages[messages.length - 1].content as string;
  expect(prompt).toContain("So What");
  expect(prompt).toContain("Blue in Green");
});
