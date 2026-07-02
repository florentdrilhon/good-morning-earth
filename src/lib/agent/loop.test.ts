import { it, expect, vi, beforeEach } from "vitest";

vi.mock("./ollama", () => ({ chat: vi.fn() }));
vi.mock("./tools", () => ({ TOOL_DEFS: [], dispatch: vi.fn().mockResolvedValue('[{"uri":"spotify:track:1"}]') }));

import { chat } from "./ollama";
import { dispatch } from "./tools";
import { runAgent, trimHistory } from "./loop";
import type { ChatMessage } from "./ollama";

beforeEach(() => (chat as any).mockClear());

const last = <T>(a: T[]): T => a[a.length - 1];

it("exécute les tool calls puis retourne la réponse finale", async () => {
  (chat as any)
    .mockResolvedValueOnce({
      role: "assistant", content: null,
      tool_calls: [{ id: "c1", function: { name: "search_spotify", arguments: '{"query":"miles"}' } }],
    })
    .mockResolvedValueOnce({ role: "assistant", content: "Voilà du Miles Davis." });

  const history = await runAgent([{ role: "user", content: "mets du jazz" }]);

  expect(dispatch).toHaveBeenCalledWith("search_spotify", { query: "miles" });
  expect(last(history)).toEqual({ role: "assistant", content: "Voilà du Miles Davis." });
  // le résultat d'outil a bien été renvoyé au modèle
  const secondCallMessages = (chat as any).mock.calls[1][0];
  expect(secondCallMessages.some((m: any) => m.role === "tool" && m.tool_call_id === "c1")).toBe(true);
  // le système est injecté en tête
  expect(secondCallMessages[0].role).toBe("system");
});

it("s'arrête après 8 itérations d'outils", async () => {
  (chat as any).mockResolvedValue({
    role: "assistant", content: null,
    tool_calls: [{ id: "x", function: { name: "get_queue", arguments: "{}" } }],
  });
  const history = await runAgent([{ role: "user", content: "boucle" }]);
  expect((chat as any).mock.calls.length).toBeLessThanOrEqual(8);
  expect(last(history)?.role).toBe("assistant");
  expect(last(history)?.content).toBeTruthy(); // message de repli, pas null
});

const uMsg = (n: number): ChatMessage => ({ role: "user", content: `u${n}` });
const aMsg = (n: number): ChatMessage => ({ role: "assistant", content: `a${n}` });

it("trimHistory ne touche pas un historique sous le cap", () => {
  const h = [uMsg(1), aMsg(1)];
  expect(trimHistory(h, 40)).toBe(h);
});

it("trimHistory borne la longueur et démarre sur un user", () => {
  const h: ChatMessage[] = [];
  for (let i = 0; i < 60; i++) h.push(i % 2 === 0 ? uMsg(i) : aMsg(i));
  const trimmed = trimHistory(h, 40);
  expect(trimmed.length).toBeLessThanOrEqual(40);
  expect(trimmed[0].role).toBe("user");
});

it("trimHistory n'orpheline jamais un message tool", () => {
  const h: ChatMessage[] = [];
  for (let i = 0; i < 20; i++) h.push(uMsg(i), aMsg(i));
  h.push(
    uMsg(99),
    { role: "assistant", content: null, tool_calls: [{ id: "c1", function: { name: "x", arguments: "{}" } }] },
    { role: "tool", content: "r", tool_call_id: "c1" },
    aMsg(99),
  );
  const trimmed = trimHistory(h, 3);
  expect(trimmed[0].role).toBe("user");
  const openIds = new Set<string>();
  for (const m of trimmed) {
    m.tool_calls?.forEach((tc) => openIds.add(tc.id));
    if (m.role === "tool") expect(openIds.has(m.tool_call_id!)).toBe(true);
  }
});
