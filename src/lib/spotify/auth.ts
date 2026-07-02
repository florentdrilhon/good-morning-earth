import { invoke } from "@tauri-apps/api/core";
import type { TokenSet } from "./types";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const REDIRECT_PORT = 8898;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-top-read",
].join(" ");

let current: TokenSet | null = null;

/** Refresh token rejeté par Spotify (invalid_grant) : il faut relancer l'OAuth. */
export class AuthExpiredError extends Error {
  constructor() {
    super("Session Spotify expirée. Reconnecte-toi.");
  }
}

class TokenHttpError extends Error {
  constructor(readonly status: number, body: string) {
    super(`Spotify token: ${status} ${body}`);
  }
}

export function randomVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function buildAuthUrl(verifier: string): Promise<string> {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: await challengeFromVerifier(verifier),
    scope: SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${p}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  if (!res.ok) throw new TokenHttpError(res.status, await res.text());
  const j = await res.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? current?.refreshToken ?? "",
    expiresAt: Date.now() + j.expires_in * 1000,
  };
}

async function persist(): Promise<void> {
  await invoke("save_secret", { key: "spotify_tokens", value: JSON.stringify(current) });
}

/** Oublie les tokens en mémoire et purge le keychain (déconnexion / migration de scope). */
export async function clearTokens(): Promise<void> {
  current = null;
  await invoke("save_secret", { key: "spotify_tokens", value: "" });
}

export async function exchangeCode(code: string, verifier: string): Promise<void> {
  current = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  await persist();
}

export async function loadStoredTokens(): Promise<boolean> {
  const v = await invoke<string | null>("load_secret", { key: "spotify_tokens" });
  if (!v) return false;
  try {
    current = JSON.parse(v);
  } catch {
    return false; // valeur keychain illisible : repasser par le login
  }
  return true;
}

export function isAuthenticated(): boolean {
  return current !== null;
}

export async function getAccessToken(): Promise<string> {
  if (!current) throw new Error("Non authentifié");
  if (Date.now() > current.expiresAt - 60_000) {
    try {
      current = await tokenRequest({ grant_type: "refresh_token", refresh_token: current.refreshToken });
    } catch (e) {
      if (e instanceof TokenHttpError && e.status === 400) {
        await clearTokens();
        throw new AuthExpiredError();
      }
      throw e;
    }
    await persist();
  }
  return current.accessToken;
}
