import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));

import { randomVerifier, challengeFromVerifier, exchangeCode, getAccessToken, AuthExpiredError, isAuthenticated } from "./auth";
import { invoke } from "@tauri-apps/api/core";

describe("PKCE", () => {
  it("génère un verifier de 64 chars unreserved", () => {
    const v = randomVerifier();
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("calcule le challenge S256 (vecteur RFC 7636)", async () => {
    const c = await challengeFromVerifier("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(c).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("tokens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("échange le code, stocke au keychain, et sert le token", async () => {
    await exchangeCode("CODE", "VERIFIER");
    const body = (fetch as any).mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("CODE");
    expect(body.get("code_verifier")).toBe("VERIFIER");
    expect(invoke).toHaveBeenCalledWith("save_secret", expect.objectContaining({ key: "spotify_tokens" }));
    expect(await getAccessToken()).toBe("AT"); // pas expiré → pas de refresh
    expect((fetch as any).mock.calls).toHaveLength(1);
  });

  it("rafraîchit le token à l'expiration en conservant le refresh token", async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 30 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT2", expires_in: 3600 }),
      });
    await exchangeCode("CODE", "VERIFIER");

    expect(await getAccessToken()).toBe("AT2");
    const refreshBody = (fetch as any).mock.calls[1][1].body as URLSearchParams;
    expect(refreshBody.get("grant_type")).toBe("refresh_token");
    expect(refreshBody.get("refresh_token")).toBe("RT");
    const saveCalls = (invoke as any).mock.calls.filter((c: any[]) => c[0] === "save_secret");
    expect(saveCalls.at(-1)[1].value).toContain('"refreshToken":"RT"');
  });

  it("refresh 400 → AuthExpiredError, purge keychain et déconnecte", async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 30 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "invalid_grant" });
    await exchangeCode("CODE", "VERIFIER");

    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(isAuthenticated()).toBe(false);
    const saveCalls = (invoke as any).mock.calls.filter((c: any[]) => c[0] === "save_secret");
    expect(saveCalls.at(-1)[1].value).toBe(""); // keychain purgé
  });
});
