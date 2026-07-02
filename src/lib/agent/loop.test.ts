import { it, expect, vi, beforeEach } from "vitest";

vi.mock("./ollama", () => ({ chat: vi.fn() }));
vi.mock("./tools", () => ({ TOOL_DEFS: [], dispatch: vi.fn().mockResolvedValue('[{"uri":"spotify:track:1"}]') }));

import { chat } from "./ollama";
import { dispatch } from "./tools";
import { runAgent } from "./loop";

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
