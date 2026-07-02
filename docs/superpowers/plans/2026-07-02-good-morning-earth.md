# Good Morning Earth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App macOS Tauri v2 qui pilote l'app Spotify officielle (API Web/Connect, OAuth PKCE) avec un agent animateur radio « Le Comte » tournant en local via Ollama.

**Architecture:** Approche « télécommande » — le son sort de l'app Spotify officielle, notre app la pilote via l'API Web Spotify. Toute l'intelligence (client Spotify, agent, outils) vit en TypeScript côté frontend ; la couche Rust est minimale (keychain, lancement de Spotify.app, callback OAuth). Le Comte est une boucle de tool-calling contre l'endpoint OpenAI-compatible d'Ollama.

**Tech Stack:** Tauri v2, React 18 + TypeScript (Vite), Vitest, tauri-plugin-oauth, keyring (Rust), Ollama (`qwen3:14b`), API Web Spotify, API Last.fm.

**Spec:** `docs/superpowers/specs/2026-07-02-good-morning-earth-design.md`

## Global Constraints

- Toute la logique métier en TypeScript sous `src/lib/` — la couche Rust ne contient QUE : `save_secret`, `load_secret`, `launch_spotify`, et le plugin oauth (portabilité Android).
- Dépendances npm autorisées : celles du scaffold Tauri/React + `@fabianlars/tauri-plugin-oauth` + `vitest`. Rien d'autre (pas de SDK Spotify, pas de SDK OpenAI — `fetch` nu).
- Dépendances Rust autorisées : scaffold + `tauri-plugin-oauth` + `keyring` (features `apple-native`).
- La queue Spotify est append-only : Le Comte programme 2-3 morceaux d'avance maximum, jamais plus.
- Anti-hallucination : toute URI Spotify passée à `add_to_queue`/`play_track` provient d'un résultat `search_spotify` réel de la conversation.
- Textes UI et persona en français.
- Modèle LLM : `qwen3:14b`, surchargeable via `VITE_OLLAMA_MODEL`.
- Secrets/config dans `.env.local` (gitignoré) : `VITE_SPOTIFY_CLIENT_ID`, `VITE_LASTFM_API_KEY`, `VITE_OLLAMA_MODEL` (optionnel).
- Redirect URI OAuth exact : `http://127.0.0.1:8898` (enregistré tel quel dans le dashboard Spotify).
- Commits fréquents, messages `feat:`/`fix:`/`docs:`/`test:`.

## Structure de fichiers cible

```
src/
  lib/
    spotify/
      types.ts      # TokenSet, Track, PlaybackState, Device, Playlist
      auth.ts       # PKCE, échange/refresh de tokens, stockage keychain
      login.ts      # orchestration du flux OAuth (plugin oauth + navigateur)
      client.ts     # tous les appels API Spotify + ensureActiveDevice
      poller.ts     # polling 3 s de l'état lecteur, détection changement de morceau
    agent/
      ollama.ts     # appel chat completions OpenAI-compatible
      persona.ts    # prompt système du Comte
      tools.ts      # définitions des outils + dispatcher
      loop.ts       # boucle de tool-calling
      announcer.ts  # mode animateur (intervention au changement de morceau)
    lastfm.ts       # similar artists/tracks, tags
  components/
    Player.tsx      # barre lecteur
    Library.tsx     # playlists / likés / recherche
    Chat.tsx        # fenêtre de chat Le Comte
  hooks/
    useComte.ts     # état du chat + envoi à l'agent
  App.tsx           # layout 3 zones + wiring
src-tauri/src/lib.rs  # commands Rust minimales
docs/design/          # livrables de la phase Claude Design
```

Tests colocalisés : `src/lib/**/*.test.ts` (Vitest, fetch mocké).

---

## Phase 0 — Prérequis manuels

### Task 0: Comptes, clés et outils (manuel, avec l'utilisateur)

**Files:**
- Create: `README.md`
- Create: `.env.local` (gitignoré — jamais commité)

**Interfaces:**
- Produces: `VITE_SPOTIFY_CLIENT_ID` et `VITE_LASTFM_API_KEY` disponibles dans `.env.local` ; Ollama qui répond sur `http://localhost:11434` avec le modèle `qwen3:14b`.

- [ ] **Step 1: Créer l'app Spotify Developer** (action utilisateur)

Sur https://developer.spotify.com/dashboard : *Create app*, nom `good-morning-earth`, Redirect URI **exactement** `http://127.0.0.1:8898`, cocher *Web API*. Récupérer le **Client ID**. Dans *User Management*, l'app en mode dev n'est utilisable que par le compte propriétaire — c'est notre cas.

- [ ] **Step 2: Créer la clé Last.fm** (action utilisateur)

Sur https://www.last.fm/api/account/create : créer un compte API (gratuit), récupérer l'**API key** (le secret ne sert pas, on ne fait que du read).

- [ ] **Step 3: Installer Ollama et le modèle**

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:14b
ollama run qwen3:14b "Réponds juste: OK"
```

Expected: le modèle répond `OK` (premier chargement lent, ~9 Go de téléchargement).

- [ ] **Step 4: Écrire `.env.local`**

```bash
cat > .env.local <<'EOF'
VITE_SPOTIFY_CLIENT_ID=<client id du step 1>
VITE_LASTFM_API_KEY=<api key du step 2>
EOF
```

- [ ] **Step 5: Écrire le README**

```markdown
# Good Morning Earth

Wrapper Spotify macOS avec Le Comte, animateur radio IA local.

## Prérequis
- macOS, app Spotify officielle installée, compte Spotify Premium
- Ollama (`brew install ollama && brew services start ollama && ollama pull qwen3:14b`)
- `.env.local` avec `VITE_SPOTIFY_CLIENT_ID` (app sur developer.spotify.com,
  redirect URI `http://127.0.0.1:8898`) et `VITE_LASTFM_API_KEY`

## Dev
npm install
npm run tauri dev

## Tests
npm test
```

- [ ] **Step 6: Commit**

```bash
git add README.md && git commit -m "docs: README prérequis"
```

---

## Phase 1 — Tracer bullet (plomberie prouvée, UI moche)

### Task 1: Scaffold Tauri v2 + React TS + Vitest

**Files:**
- Create: scaffold complet (`package.json`, `src/`, `src-tauri/`, `vite.config.ts`…)
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- Produces: `npm run tauri dev` ouvre une fenêtre ; `npm test` lance Vitest.

- [ ] **Step 1: Scaffolder dans le dossier courant**

```bash
npm create tauri-app@latest . -- --name good-morning-earth --identifier com.florent.goodmorningearth --template react-ts --manager npm --yes
npm install
```

Si create-tauri-app refuse le dossier non vide : scaffolder dans `/tmp/gme-scaffold` puis `rsync -a /tmp/gme-scaffold/ .` (sans écraser `docs/` ni `.git/`).

- [ ] **Step 2: Ajouter Vitest**

```bash
npm install -D vitest
```

Dans `package.json`, ajouter `"test": "vitest run"` aux scripts.

- [ ] **Step 3: S'assurer que `.env.local` est gitignoré**

Vérifier que `.gitignore` contient `*.local` (le scaffold Vite le met par défaut ; sinon l'ajouter).

- [ ] **Step 4: Vérifier le lancement**

Run: `npm run tauri dev` — Expected: fenêtre « Welcome to Tauri » (fermer ensuite). Premier build Rust long (~2-5 min).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Tauri v2 + React TS + Vitest"
```

### Task 2: Couche Rust — keychain, launch Spotify, plugin OAuth

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces: commands Tauri `save_secret(key, value)`, `load_secret(key) -> string | null`, `launch_spotify()` ; plugin `oauth` enregistré (JS: `start`/`onUrl`/`cancel` de `@fabianlars/tauri-plugin-oauth`).

- [ ] **Step 1: Ajouter les dépendances**

```bash
cd src-tauri && cargo add tauri-plugin-oauth && cargo add keyring --features apple-native && cd ..
npm install @fabianlars/tauri-plugin-oauth
```

- [ ] **Step 2: Écrire `src-tauri/src/lib.rs`**

```rust
use keyring::Entry;

const SERVICE: &str = "good-morning-earth";

#[tauri::command]
fn save_secret(key: String, value: String) -> Result<(), String> {
    Entry::new(SERVICE, &key)
        .and_then(|e| e.set_password(&value))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn launch_spotify() -> Result<(), String> {
    // -g : ne pas mettre Spotify au premier plan
    let status = std::process::Command::new("open")
        .args(["-g", "-a", "Spotify"])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err("open -a Spotify a échoué".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![save_secret, load_secret, launch_spotify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

(Adapter à la structure du scaffold : garder les plugins déjà présents dans `run()`.)

- [ ] **Step 3: Autoriser les permissions du plugin**

Dans `src-tauri/capabilities/default.json`, ajouter à `"permissions"` :

```json
"oauth:allow-start", "oauth:allow-cancel", "opener:default"
```

- [ ] **Step 4: Vérifier la compilation**

Run: `cd src-tauri && cargo check && cd ..` — Expected: `Finished` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: couche Rust — keychain, launch_spotify, plugin oauth"
```

### Task 3: Types + module PKCE/tokens (TDD)

**Files:**
- Create: `src/lib/spotify/types.ts`, `src/lib/spotify/auth.ts`
- Test: `src/lib/spotify/auth.test.ts`

**Interfaces:**
- Produces: `randomVerifier(): string`, `challengeFromVerifier(v): Promise<string>`, `buildAuthUrl(verifier): Promise<string>`, `exchangeCode(code, verifier): Promise<void>`, `loadStoredTokens(): Promise<boolean>`, `getAccessToken(): Promise<string>`, `isAuthenticated(): boolean`, `REDIRECT_URI`, `REDIRECT_PORT` ; types `TokenSet`, `Track`, `PlaybackState`, `Device`, `Playlist`.

- [ ] **Step 1: Écrire `src/lib/spotify/types.ts`**

```typescript
export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface Track {
  uri: string;
  name: string;
  artists: string; // "Artiste A, Artiste B"
  albumName: string;
  albumArt: string | null;
  durationMs: number;
}

export interface PlaybackState {
  track: Track | null;
  isPlaying: boolean;
  progressMs: number;
  volumePercent: number;
}

export interface Device {
  id: string;
  name: string;
  type: string; // "Computer", "Smartphone"…
  is_active: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  image: string | null;
}
```

- [ ] **Step 2: Écrire le test qui échoue**

```typescript
// src/lib/spotify/auth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));

import { randomVerifier, challengeFromVerifier, exchangeCode, getAccessToken } from "./auth";
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
});
```

- [ ] **Step 3: Vérifier l'échec** — Run: `npm test` — Expected: FAIL (`./auth` introuvable).

- [ ] **Step 4: Écrire `src/lib/spotify/auth.ts`**

```typescript
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
].join(" ");

let current: TokenSet | null = null;

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
  if (!res.ok) throw new Error(`Spotify token: ${res.status} ${await res.text()}`);
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
  current = JSON.parse(v);
  return true;
}

export function isAuthenticated(): boolean {
  return current !== null;
}

export async function getAccessToken(): Promise<string> {
  if (!current) throw new Error("Non authentifié");
  if (Date.now() > current.expiresAt - 60_000) {
    current = await tokenRequest({ grant_type: "refresh_token", refresh_token: current.refreshToken });
    await persist();
  }
  return current.accessToken;
}
```

- [ ] **Step 5: Vérifier le pass** — Run: `npm test` — Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/spotify && git commit -m "feat: types + auth PKCE avec refresh et keychain"
```

### Task 4: Flux de login OAuth

**Files:**
- Create: `src/lib/spotify/login.ts`

**Interfaces:**
- Consumes: `randomVerifier`, `buildAuthUrl`, `exchangeCode`, `REDIRECT_PORT` (Task 3) ; plugin oauth (Task 2).
- Produces: `login(): Promise<void>` — flux OAuth complet, tokens stockés à la fin.

- [ ] **Step 1: Écrire `src/lib/spotify/login.ts`**

```typescript
import { start, cancel, onUrl } from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { randomVerifier, buildAuthUrl, exchangeCode, REDIRECT_PORT } from "./auth";

export async function login(): Promise<void> {
  const verifier = randomVerifier();
  await start({ ports: [REDIRECT_PORT] });
  try {
    const code = await new Promise<string>((resolve, reject) => {
      onUrl((url) => {
        const u = new URL(url);
        const err = u.searchParams.get("error");
        if (err) return reject(new Error(`Spotify a refusé: ${err}`));
        const c = u.searchParams.get("code");
        if (c) resolve(c);
      });
      buildAuthUrl(verifier).then(openUrl).catch(reject);
    });
    await exchangeCode(code, verifier);
  } finally {
    await cancel(REDIRECT_PORT).catch(() => {});
  }
}
```

Pas de test unitaire : ce module n'est que du câblage de plugins Tauri, il se valide en E2E à la Task 6.

- [ ] **Step 2: Vérifier la compilation** — Run: `npx tsc --noEmit` — Expected: aucun bruit nouveau.

- [ ] **Step 3: Commit**

```bash
git add src/lib/spotify/login.ts && git commit -m "feat: flux de login OAuth via plugin oauth"
```

### Task 5: Client Spotify minimal — état lecteur, pause/resume, ensureActiveDevice (TDD)

**Files:**
- Create: `src/lib/spotify/client.ts`
- Test: `src/lib/spotify/client.test.ts`

**Interfaces:**
- Consumes: `getAccessToken` (Task 3), command `launch_spotify` (Task 2).
- Produces: `getPlaybackState(): Promise<PlaybackState | null>`, `pause()`, `resume()`, `getDevices(): Promise<Device[]>`, `transferPlayback(deviceId)`, `ensureActiveDevice(): Promise<void>`, `mapTrack(raw): Track`, classe `SpotifyError` — et le helper interne `api()` que les tasks 7-8 étendent.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/spotify/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock("./auth", () => ({ getAccessToken: vi.fn().mockResolvedValue("TOKEN") }));

import { getPlaybackState, pause } from "./client";

const rawState = {
  is_playing: true,
  progress_ms: 1000,
  device: { volume_percent: 50 },
  item: {
    uri: "spotify:track:1",
    name: "So What",
    artists: [{ name: "Miles Davis" }],
    album: { name: "Kind of Blue", images: [{ url: "http://img" }] },
    duration_ms: 545000,
  },
};

function mockFetch(...responses: Array<Partial<Response>>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => "", ...r });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("client", () => {
  it("mappe l'état de lecture", async () => {
    mockFetch({ json: async () => rawState });
    const s = await getPlaybackState();
    expect(s?.track).toEqual({
      uri: "spotify:track:1",
      name: "So What",
      artists: "Miles Davis",
      albumName: "Kind of Blue",
      albumArt: "http://img",
      durationMs: 545000,
    });
    expect(s?.isPlaying).toBe(true);
    expect(s?.volumePercent).toBe(50);
  });

  it("retourne null si rien ne joue (204)", async () => {
    mockFetch({ status: 204 });
    expect(await getPlaybackState()).toBeNull();
  });

  it("envoie le Bearer token et retente une fois sur 429", async () => {
    const f = mockFetch(
      { ok: false, status: 429, headers: new Headers({ "Retry-After": "0" }) },
      { status: 204 },
    );
    await pause();
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer TOKEN");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL (`./client` introuvable).

- [ ] **Step 3: Écrire `src/lib/spotify/client.ts`**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { getAccessToken } from "./auth";
import type { Device, PlaybackState, Track } from "./types";

const BASE = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(public status: number, message: string) {
    super(`Spotify ${status}: ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T | null> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 429 && !retried) {
    await sleep(Number(res.headers.get("Retry-After") ?? "1") * 1000);
    return api(path, init, true);
  }
  if (res.status === 204) return null;
  if (!res.ok) throw new SpotifyError(res.status, await res.text());
  return res.json();
}

export function mapTrack(item: any): Track {
  return {
    uri: item.uri,
    name: item.name,
    artists: item.artists.map((a: any) => a.name).join(", "),
    albumName: item.album?.name ?? "",
    albumArt: item.album?.images?.[0]?.url ?? null,
    durationMs: item.duration_ms,
  };
}

export async function getPlaybackState(): Promise<PlaybackState | null> {
  const raw = await api<any>("/me/player");
  if (!raw) return null;
  return {
    track: raw.item ? mapTrack(raw.item) : null,
    isPlaying: raw.is_playing,
    progressMs: raw.progress_ms ?? 0,
    volumePercent: raw.device?.volume_percent ?? 0,
  };
}

export const pause = () => api("/me/player/pause", { method: "PUT" });
export const resume = () => api("/me/player/play", { method: "PUT" });

export async function getDevices(): Promise<Device[]> {
  const raw = await api<any>("/me/player/devices");
  return raw?.devices ?? [];
}

export const transferPlayback = (deviceId: string) =>
  api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId] }) });

export async function ensureActiveDevice(): Promise<void> {
  let devices = await getDevices();
  if (devices.some((d) => d.is_active)) return;
  let local = devices.find((d) => d.type === "Computer");
  if (!local) {
    await invoke("launch_spotify");
    for (let i = 0; i < 10 && !local; i++) {
      await sleep(1000);
      devices = await getDevices();
      local = devices.find((d) => d.type === "Computer");
    }
  }
  if (!local) throw new Error("Spotify introuvable sur ce Mac — lance l'app Spotify et réessaie.");
  await transferPlayback(local.id);
}
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS (7 tests au total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify && git commit -m "feat: client Spotify minimal (état, pause/resume, ensureActiveDevice)"
```

### Task 6: UI tracer bullet + validation E2E ✋

**Files:**
- Modify: `src/App.tsx` (remplacer le contenu du scaffold), `src/App.css` (vider)

**Interfaces:**
- Consumes: `login` (Task 4), `loadStoredTokens`, `isAuthenticated` (Task 3), `getPlaybackState`, `pause`, `resume`, `ensureActiveDevice` (Task 5).

- [ ] **Step 1: Écrire `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { login } from "./lib/spotify/login";
import { loadStoredTokens, isAuthenticated } from "./lib/spotify/auth";
import { getPlaybackState, pause, resume, ensureActiveDevice } from "./lib/spotify/client";
import type { PlaybackState } from "./lib/spotify/types";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredTokens().then((ok) => setAuthed(ok));
  }, []);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => getPlaybackState().then(setState).catch((e) => setError(String(e))), 3000);
    return () => clearInterval(id);
  }, [authed]);

  const run = (fn: () => Promise<unknown>) => () =>
    ensureActiveDevice().then(fn).then(() => setError(null)).catch((e) => setError(String(e)));

  if (!authed)
    return <button onClick={() => login().then(() => setAuthed(isAuthenticated()))}>Se connecter à Spotify</button>;

  return (
    <main>
      <p>{state?.track ? `${state.track.name} — ${state.track.artists}` : "Rien ne joue"}</p>
      <button onClick={run(state?.isPlaying ? pause : resume)}>{state?.isPlaying ? "Pause" : "Play"}</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Validation E2E manuelle** ✋ CHECKPOINT avec l'utilisateur

Run: `npm run tauri dev`, puis :
1. Cliquer « Se connecter à Spotify » → le navigateur s'ouvre, autoriser → retour app.
2. Le morceau en cours s'affiche (en lancer un dans Spotify si besoin).
3. Play/Pause fonctionne, y compris avec Spotify.app fermée au départ (elle doit se lancer toute seule).
4. Relancer l'app → toujours connecté (keychain).

Expected: les 4 points passent. **La plomberie est prouvée.**

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: tracer bullet — login, now playing, play/pause E2E"
```

---

## Phase 2 — UX/UI avec Claude Design ✋

### Task 7: Session de design (interactive, avec l'utilisateur)

**Files:**
- Create: `docs/design/brief.md`, `docs/design/tokens.css` (+ mockups exportés dans `docs/design/`)
- Create: `src/styles/tokens.css` (copie du livrable)

**Interfaces:**
- Produces: variables CSS (`--bg`, `--surface`, `--text`, `--text-dim`, `--accent`, `--radius`, `--font-ui`) consommées par TOUTES les tasks UI de la phase 4 ; décisions de layout figées (positions des 3 zones, dimensions fenêtre par défaut).

- [ ] **Step 1: Écrire le brief `docs/design/brief.md`**

Contenu : rappel du concept (radio personnelle + Le Comte), les 3 zones (lecteur bas, bibliothèque gauche, chat droite), le ton du personnage (érudit, chaleureux), contrainte : thème sombre par défaut (app musicale), inspirations à discuter (Spotify, Poolsuite, apps radio rétro).

- [ ] **Step 2: Session Claude Design** ✋ CHECKPOINT — session interactive utilisateur

Explorer 2-3 directions visuelles (mockups des 3 zones + états : rien ne joue, Le Comte qui écrit, mode animateur). L'utilisateur tranche.

- [ ] **Step 3: Extraire les tokens**

Convertir la direction retenue en `docs/design/tokens.css` (variables CSS uniquement), copier vers `src/styles/tokens.css`.

- [ ] **Step 4: Commit**

```bash
git add docs/design src/styles && git commit -m "docs: direction design + tokens CSS"
```

---

## Phase 3 — Client Spotify complet

### Task 8: Recherche, queue, contrôles restants (TDD)

**Files:**
- Modify: `src/lib/spotify/client.ts`
- Test: `src/lib/spotify/client.test.ts` (ajouter)

**Interfaces:**
- Consumes: helper `api()`, `mapTrack` (Task 5).
- Produces: `searchTracks(query, limit=8): Promise<Track[]>`, `addToQueue(uri)`, `getQueue(): Promise<Track[]>`, `playTrack(uri)`, `skipNext()`, `skipPrevious()`, `setVolume(percent)`.

- [ ] **Step 1: Ajouter les tests**

```typescript
// à ajouter dans client.test.ts
import { searchTracks, addToQueue } from "./client";

describe("recherche et queue", () => {
  it("mappe les résultats de recherche", async () => {
    mockFetch({ json: async () => ({ tracks: { items: [rawState.item] } }) });
    const tracks = await searchTracks("so what");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].uri).toBe("spotify:track:1");
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("q=so+what");
    expect(url).toContain("type=track");
  });

  it("encode l'URI dans l'ajout à la queue", async () => {
    const f = mockFetch({ status: 204 });
    await addToQueue("spotify:track:1");
    expect(f.mock.calls[0][0]).toContain(`uri=${encodeURIComponent("spotify:track:1")}`);
    expect(f.mock.calls[0][1].method).toBe("POST");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL (exports manquants).

- [ ] **Step 3: Implémenter dans `client.ts`**

```typescript
export async function searchTracks(query: string, limit = 8): Promise<Track[]> {
  const p = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const raw = await api<any>(`/search?${p}`);
  return (raw?.tracks?.items ?? []).map(mapTrack);
}

export const addToQueue = (uri: string) =>
  api(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: "POST" });

export async function getQueue(): Promise<Track[]> {
  const raw = await api<any>("/me/player/queue");
  return (raw?.queue ?? []).map(mapTrack);
}

export const playTrack = (uri: string) =>
  api("/me/player/play", { method: "PUT", body: JSON.stringify({ uris: [uri] }) });

export const skipNext = () => api("/me/player/next", { method: "POST" });
export const skipPrevious = () => api("/me/player/previous", { method: "POST" });
export const setVolume = (percent: number) =>
  api(`/me/player/volume?volume_percent=${Math.round(percent)}`, { method: "PUT" });
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify && git commit -m "feat: recherche, queue, contrôles complets"
```

### Task 9: Bibliothèque — playlists, likés, sauvegarde (TDD)

**Files:**
- Modify: `src/lib/spotify/client.ts`
- Test: `src/lib/spotify/client.test.ts` (ajouter)

**Interfaces:**
- Consumes: helper `api()`, `mapTrack` (Task 5).
- Produces: `getPlaylists(): Promise<Playlist[]>`, `getPlaylistTracks(id): Promise<Track[]>`, `getLikedTracks(limit=50): Promise<Track[]>`, `saveTrack(trackId)`, `addToPlaylist(playlistId, uri)`, `trackIdFromUri(uri): string`.

- [ ] **Step 1: Ajouter les tests**

```typescript
// à ajouter dans client.test.ts
import { getPlaylists, trackIdFromUri, saveTrack } from "./client";

describe("bibliothèque", () => {
  it("mappe les playlists", async () => {
    mockFetch({
      json: async () => ({
        items: [{ id: "p1", name: "Jazz", tracks: { total: 12 }, images: [{ url: "http://i" }] }],
      }),
    });
    expect(await getPlaylists()).toEqual([{ id: "p1", name: "Jazz", trackCount: 12, image: "http://i" }]);
  });

  it("extrait l'id d'une URI et sauvegarde", async () => {
    expect(trackIdFromUri("spotify:track:abc123")).toBe("abc123");
    const f = mockFetch({ status: 204 });
    await saveTrack("abc123");
    expect(f.mock.calls[0][0]).toContain("/me/tracks?ids=abc123");
    expect(f.mock.calls[0][1].method).toBe("PUT");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implémenter dans `client.ts`**

```typescript
import type { Playlist } from "./types"; // fusionner avec l'import existant

export async function getPlaylists(): Promise<Playlist[]> {
  const raw = await api<any>("/me/playlists?limit=50");
  return (raw?.items ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    trackCount: p.tracks?.total ?? 0,
    image: p.images?.[0]?.url ?? null,
  }));
}

export async function getPlaylistTracks(id: string): Promise<Track[]> {
  const raw = await api<any>(`/playlists/${id}/tracks?limit=100`);
  return (raw?.items ?? []).filter((i: any) => i.track).map((i: any) => mapTrack(i.track));
}

export async function getLikedTracks(limit = 50): Promise<Track[]> {
  const raw = await api<any>(`/me/tracks?limit=${limit}`);
  return (raw?.items ?? []).map((i: any) => mapTrack(i.track));
}

export const trackIdFromUri = (uri: string) => uri.split(":").pop() ?? uri;

export const saveTrack = (trackId: string) =>
  api(`/me/tracks?ids=${trackId}`, { method: "PUT" });

export const addToPlaylist = (playlistId: string, uri: string) =>
  api(`/playlists/${playlistId}/tracks`, { method: "POST", body: JSON.stringify({ uris: [uri] }) });
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify && git commit -m "feat: bibliothèque — playlists, likés, save track"
```

### Task 10: Poller — détection de changement de morceau (TDD)

**Files:**
- Create: `src/lib/spotify/poller.ts`
- Test: `src/lib/spotify/poller.test.ts`

**Interfaces:**
- Consumes: `getPlaybackState` (Task 5).
- Produces: `startPoller(handlers: { onState(s: PlaybackState | null): void; onTrackChange(track: Track, previous: Track | null): void }, intervalMs = 3000): () => void` (retourne la fonction d'arrêt).

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/spotify/poller.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./client", () => ({ getPlaybackState: vi.fn() }));
import { getPlaybackState } from "./client";
import { startPoller } from "./poller";
import type { PlaybackState } from "./types";

const state = (uri: string): PlaybackState => ({
  track: { uri, name: uri, artists: "A", albumName: "", albumArt: null, durationMs: 1 },
  isPlaying: true,
  progressMs: 0,
  volumePercent: 50,
});

afterEach(() => vi.useRealTimers());

it("émet onTrackChange une seule fois par nouveau morceau", async () => {
  vi.useFakeTimers();
  (getPlaybackState as any)
    .mockResolvedValueOnce(state("t1"))
    .mockResolvedValueOnce(state("t1"))
    .mockResolvedValueOnce(state("t2"));
  const onTrackChange = vi.fn();
  const stop = startPoller({ onState: () => {}, onTrackChange }, 1000);
  for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(1000);
  stop();
  expect(onTrackChange).toHaveBeenCalledTimes(2); // t1 (premier), puis t2
  expect(onTrackChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ uri: "t2" }),
    expect.objectContaining({ uri: "t1" }),
  );
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Écrire `src/lib/spotify/poller.ts`**

```typescript
import { getPlaybackState } from "./client";
import type { PlaybackState, Track } from "./types";

interface Handlers {
  onState(s: PlaybackState | null): void;
  onTrackChange(track: Track, previous: Track | null): void;
}

export function startPoller(handlers: Handlers, intervalMs = 3000): () => void {
  let lastTrack: Track | null = null;
  const tick = async () => {
    try {
      const s = await getPlaybackState();
      handlers.onState(s);
      if (s?.track && s.track.uri !== lastTrack?.uri) {
        handlers.onTrackChange(s.track, lastTrack);
        lastTrack = s.track;
      }
    } catch {
      // erreur réseau ponctuelle : on retentera au prochain tick
    }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotify && git commit -m "feat: poller avec détection de changement de morceau"
```

---

## Phase 4 — UI finale (selon design de la Task 7)

### Task 11: Layout 3 zones + barre lecteur

**Files:**
- Create: `src/components/Player.tsx`
- Modify: `src/App.tsx`, `src/App.css`, `src/main.tsx` (importer `src/styles/tokens.css`)

**Interfaces:**
- Consumes: `startPoller` (Task 10), contrôles client (Tasks 5, 8), tokens CSS (Task 7).
- Produces: `App` gère l'état global `playback: PlaybackState | null` et le passe en props ; grid 3 zones avec emplacements `<Library />` et `<Chat />` (placeholders `<aside/>`, remplis Tasks 12-13).

- [ ] **Step 1: Écrire `src/components/Player.tsx`**

```tsx
import type { PlaybackState } from "../lib/spotify/types";
import { pause, resume, skipNext, skipPrevious, setVolume, ensureActiveDevice } from "../lib/spotify/client";

export function Player({ state }: { state: PlaybackState | null }) {
  const run = (fn: () => Promise<unknown>) => () => ensureActiveDevice().then(fn).catch(console.error);
  const t = state?.track;
  return (
    <footer className="player">
      {t?.albumArt && <img src={t.albumArt} alt="" className="player-art" />}
      <div className="player-info">
        <div className="player-title">{t?.name ?? "Rien ne joue"}</div>
        <div className="player-artists">{t?.artists ?? "—"}</div>
      </div>
      <div className="player-controls">
        <button onClick={run(skipPrevious)}>⏮</button>
        <button onClick={run(state?.isPlaying ? pause : resume)}>{state?.isPlaying ? "⏸" : "▶"}</button>
        <button onClick={run(skipNext)}>⏭</button>
      </div>
      <input
        type="range" min={0} max={100} defaultValue={state?.volumePercent ?? 50}
        onChange={(e) => setVolume(Number(e.target.value)).catch(console.error)}
        className="player-volume"
      />
    </footer>
  );
}
```

- [ ] **Step 2: Réécrire `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { login } from "./lib/spotify/login";
import { loadStoredTokens, isAuthenticated } from "./lib/spotify/auth";
import { startPoller } from "./lib/spotify/poller";
import type { PlaybackState } from "./lib/spotify/types";
import { Player } from "./components/Player";
import "./App.css";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);

  useEffect(() => {
    loadStoredTokens().then(setAuthed);
  }, []);

  useEffect(() => {
    if (!authed) return;
    return startPoller({ onState: setPlayback, onTrackChange: () => {} });
  }, [authed]);

  if (!authed)
    return (
      <div className="login-screen">
        <h1>Good Morning Earth</h1>
        <button onClick={() => login().then(() => setAuthed(isAuthenticated()))}>Se connecter à Spotify</button>
      </div>
    );

  return (
    <div className="layout">
      <aside className="zone-library">{/* Library — Task 12 */}</aside>
      <section className="zone-chat">{/* Chat — Task 13 */}</section>
      <Player state={playback} />
    </div>
  );
}
```

- [ ] **Step 3: Écrire `src/App.css` selon les tokens du design**

Structure imposée (les valeurs visuelles viennent de `src/styles/tokens.css`) :

```css
.layout {
  display: grid;
  grid-template: "library chat" 1fr "player player" auto / 280px 1fr;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
}
.zone-library { grid-area: library; overflow-y: auto; background: var(--surface); }
.zone-chat { grid-area: chat; display: flex; flex-direction: column; }
.player { grid-area: player; display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface); }
.player-art { width: 48px; height: 48px; border-radius: var(--radius); }
.player-info { min-width: 0; flex: 0 1 240px; }
.player-artists { color: var(--text-dim); font-size: 0.85em; }
.player-controls { display: flex; gap: 8px; margin-inline: auto; }
.login-screen { display: grid; place-items: center; height: 100vh; background: var(--bg); color: var(--text); }
```

(Compléter avec la direction retenue en Task 7 — spacing, boutons, scrollbars.)

- [ ] **Step 4: Vérification visuelle** — Run: `npm run tauri dev` — Expected: layout 3 zones, lecteur fonctionnel en bas conforme aux mockups.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: layout 3 zones + barre lecteur"
```

### Task 12: Panneau bibliothèque + recherche

**Files:**
- Create: `src/components/Library.tsx`
- Modify: `src/App.tsx` (remplacer le placeholder), `src/App.css` (styles du panneau)

**Interfaces:**
- Consumes: `getPlaylists`, `getPlaylistTracks`, `getLikedTracks`, `searchTracks`, `playTrack`, `addToQueue`, `saveTrack`, `trackIdFromUri`, `ensureActiveDevice` (Tasks 5, 8, 9).
- Produces: `<Library />` autonome (charge ses données elle-même).

- [ ] **Step 1: Écrire `src/components/Library.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  getPlaylists, getPlaylistTracks, getLikedTracks, searchTracks,
  playTrack, addToQueue, saveTrack, trackIdFromUri, ensureActiveDevice,
} from "../lib/spotify/client";
import type { Playlist, Track } from "../lib/spotify/types";

export function Library() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [heading, setHeading] = useState("Titres likés");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getPlaylists().then(setPlaylists).catch(console.error);
    getLikedTracks().then(setTracks).catch(console.error);
  }, []);

  const show = (h: string, load: Promise<Track[]>) => {
    setHeading(h);
    load.then(setTracks).catch(console.error);
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) show(`Résultats : ${query}`, searchTracks(query));
  };

  return (
    <div className="library">
      <form onSubmit={search}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" />
      </form>
      <nav>
        <button onClick={() => show("Titres likés", getLikedTracks())}>♥ Titres likés</button>
        {playlists.map((p) => (
          <button key={p.id} onClick={() => show(p.name, getPlaylistTracks(p.id))}>{p.name}</button>
        ))}
      </nav>
      <h3>{heading}</h3>
      <ul className="track-list">
        {tracks.map((t) => (
          <li key={t.uri}>
            <span className="track-name" onClick={() => ensureActiveDevice().then(() => playTrack(t.uri))}>
              {t.name} <em>{t.artists}</em>
            </span>
            <button title="Ajouter à la file" onClick={() => addToQueue(t.uri)}>＋</button>
            <button title="Liker" onClick={() => saveTrack(trackIdFromUri(t.uri))}>♥</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Brancher dans `App.tsx`**

Remplacer `<aside className="zone-library">{/* Library — Task 12 */}</aside>` par `<aside className="zone-library"><Library /></aside>` (+ import).

- [ ] **Step 3: Styler `.library`, `.track-list` dans `App.css`** selon les tokens (liste dense, hover, ellipsis sur les titres longs).

- [ ] **Step 4: Vérification visuelle** — Run: `npm run tauri dev` — Expected: playlists listées, clic joue un morceau, recherche fonctionne, ＋ ajoute à la queue.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: panneau bibliothèque + recherche"
```

### Task 13: Fenêtre de chat (UI seule, agent branché en Task 18)

**Files:**
- Create: `src/components/Chat.tsx`
- Modify: `src/App.tsx`, `src/App.css`

**Interfaces:**
- Produces: `<Chat messages={UiMessage[]} busy={boolean} onSend={(text: string) => void} />` avec `interface UiMessage { role: "user" | "comte"; text: string }` (exportée depuis `Chat.tsx`).

- [ ] **Step 1: Écrire `src/components/Chat.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";

export interface UiMessage {
  role: "user" | "comte";
  text: string;
}

export function Chat({ messages, busy, onSend }: {
  messages: UiMessage[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    onSend(draft.trim());
    setDraft("");
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="bubble bubble-comte bubble-typing">Le Comte réfléchit…</div>}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit} className="chat-input">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Parle au Comte…" disabled={busy} />
        <button disabled={busy || !draft.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Brancher dans `App.tsx` avec un état local provisoire**

```tsx
// dans App(), en attendant useComte (Task 18) :
const [messages, setMessages] = useState<UiMessage[]>([]);
const onSend = (text: string) =>
  setMessages((m) => [...m, { role: "user", text }, { role: "comte", text: "(Le Comte arrive bientôt.)" }]);
// dans le JSX :
<section className="zone-chat"><Chat messages={messages} busy={false} onSend={onSend} /></section>
```

- [ ] **Step 3: Styler `.chat`, `.bubble*` dans `App.css`** selon les tokens (bulles utilisateur à droite, Comte à gauche, input collé en bas).

- [ ] **Step 4: Vérification visuelle** — Run: `npm run tauri dev` — Expected: chat scrollable, envoi fonctionne, réponse placeholder.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: fenêtre de chat (UI)"
```

---

## Phase 5 — Le Comte

### Task 14: Client Ollama (TDD)

**Files:**
- Create: `src/lib/agent/ollama.ts`
- Test: `src/lib/agent/ollama.test.ts`

**Interfaces:**
- Produces: types `ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }`, `ToolCall { id: string; function: { name: string; arguments: string } }`, `ToolDef` (schéma fonction OpenAI) ; `chat(messages: ChatMessage[], tools: ToolDef[]): Promise<ChatMessage>` ; classe `OllamaDownError`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/agent/ollama.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
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
});

it("lève OllamaDownError si Ollama ne répond pas", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(chat([], [])).rejects.toBeInstanceOf(OllamaDownError);
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Écrire `src/lib/agent/ollama.ts`**

```typescript
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
    });
  } catch {
    throw new OllamaDownError();
  }
  if (!res.ok) throw new Error(`Ollama: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.choices[0].message;
}
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent && git commit -m "feat: client Ollama OpenAI-compatible"
```

### Task 15: Client Last.fm (TDD)

**Files:**
- Create: `src/lib/lastfm.ts`
- Test: `src/lib/lastfm.test.ts`

**Interfaces:**
- Produces: `similarArtists(artist): Promise<string[]>`, `similarTracks(artist, track): Promise<{ artist: string; name: string }[]>`, `topTags(artist): Promise<string[]>`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/lastfm.test.ts
import { it, expect, vi, afterEach } from "vitest";
import { similarArtists } from "./lastfm";

afterEach(() => vi.unstubAllGlobals());

it("retourne les noms d'artistes similaires", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ similarartists: { artist: [{ name: "John Coltrane" }, { name: "Bill Evans" }] } }),
  }));
  expect(await similarArtists("Miles Davis")).toEqual(["John Coltrane", "Bill Evans"]);
  const url = (fetch as any).mock.calls[0][0] as string;
  expect(url).toContain("method=artist.getsimilar");
  expect(url).toContain("artist=Miles+Davis");
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Écrire `src/lib/lastfm.ts`**

```typescript
const BASE = "https://ws.audioscrobbler.com/2.0/";
const KEY = import.meta.env.VITE_LASTFM_API_KEY as string;

async function lastfm<T>(params: Record<string, string>): Promise<T> {
  const p = new URLSearchParams({ ...params, api_key: KEY, format: "json" });
  const res = await fetch(`${BASE}?${p}`);
  if (!res.ok) throw new Error(`Last.fm: ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`Last.fm: ${j.message}`);
  return j;
}

export async function similarArtists(artist: string): Promise<string[]> {
  const j = await lastfm<any>({ method: "artist.getsimilar", artist, limit: "10" });
  return (j.similarartists?.artist ?? []).map((a: any) => a.name);
}

export async function similarTracks(artist: string, track: string): Promise<{ artist: string; name: string }[]> {
  const j = await lastfm<any>({ method: "track.getsimilar", artist, track, limit: "10" });
  return (j.similartracks?.track ?? []).map((t: any) => ({ artist: t.artist?.name ?? "", name: t.name }));
}

export async function topTags(artist: string): Promise<string[]> {
  const j = await lastfm<any>({ method: "artist.gettoptags", artist });
  return (j.toptags?.tag ?? []).slice(0, 8).map((t: any) => t.name);
}
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib && git commit -m "feat: client Last.fm (similarités, tags)"
```

### Task 16: Outils du Comte — définitions + dispatcher (TDD)

**Files:**
- Create: `src/lib/agent/tools.ts`
- Test: `src/lib/agent/tools.test.ts`

**Interfaces:**
- Consumes: tout le client Spotify (Tasks 5, 8, 9), `lastfm.ts` (Task 15), type `ToolDef` (Task 14).
- Produces: `TOOL_DEFS: ToolDef[]`, `dispatch(name: string, args: Record<string, any>): Promise<string>` (résultat toujours JSON stringifié, compact).

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/agent/tools.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../spotify/client", () => ({
  searchTracks: vi.fn().mockResolvedValue([
    { uri: "spotify:track:1", name: "So What", artists: "Miles Davis", albumName: "Kind of Blue", albumArt: null, durationMs: 1 },
  ]),
  addToQueue: vi.fn().mockResolvedValue(null),
  ensureActiveDevice: vi.fn().mockResolvedValue(undefined),
  playTrack: vi.fn(), pause: vi.fn(), resume: vi.fn(), skipNext: vi.fn(), setVolume: vi.fn(),
  getPlaybackState: vi.fn(), getQueue: vi.fn(), getPlaylists: vi.fn(), getPlaylistTracks: vi.fn(),
  getLikedTracks: vi.fn(), saveTrack: vi.fn(), addToPlaylist: vi.fn(), trackIdFromUri: (u: string) => u.split(":").pop(),
}));
vi.mock("../lastfm", () => ({ similarArtists: vi.fn(), similarTracks: vi.fn(), topTags: vi.fn() }));

import { TOOL_DEFS, dispatch } from "./tools";
import { addToQueue, ensureActiveDevice } from "../spotify/client";

describe("tools", () => {
  it("expose chaque outil avec un schéma valide", () => {
    for (const t of TOOL_DEFS) {
      expect(t.type).toBe("function");
      expect(t.function.name).toMatch(/^[a-z_]+$/);
      expect(t.function.description.length).toBeGreaterThan(10);
    }
  });

  it("search_spotify retourne des tracks compacts avec URIs", async () => {
    const out = JSON.parse(await dispatch("search_spotify", { query: "so what" }));
    expect(out[0]).toEqual({ uri: "spotify:track:1", name: "So What", artists: "Miles Davis", album: "Kind of Blue" });
  });

  it("add_to_queue garantit un device actif puis ajoute", async () => {
    await dispatch("add_to_queue", { uri: "spotify:track:1" });
    expect(ensureActiveDevice).toHaveBeenCalled();
    expect(addToQueue).toHaveBeenCalledWith("spotify:track:1");
  });

  it("outil inconnu → message d'erreur, pas d'exception", async () => {
    expect(await dispatch("nope", {})).toContain("Outil inconnu");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Écrire `src/lib/agent/tools.ts`**

```typescript
import * as sp from "../spotify/client";
import * as fm from "../lastfm";
import type { Track } from "../spotify/types";
import type { ToolDef } from "./ollama";

const slim = (tracks: Track[]) =>
  tracks.map((t) => ({ uri: t.uri, name: t.name, artists: t.artists, album: t.albumName }));

const str = { type: "string" } as const;
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolDef => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOL_DEFS: ToolDef[] = [
  tool("search_spotify", "Recherche des morceaux sur Spotify. Retourne nom, artistes, album et URI. TOUJOURS utiliser cet outil pour obtenir une URI avant de jouer ou mettre en file un morceau.", { query: str }, ["query"]),
  tool("play_track", "Joue immédiatement un morceau (URI issue de search_spotify).", { uri: str }, ["uri"]),
  tool("add_to_queue", "Ajoute un morceau à la file d'attente (URI issue de search_spotify). La file est append-only : ajoute 2-3 morceaux d'avance maximum.", { uri: str }, ["uri"]),
  tool("get_playback_state", "État actuel : morceau en cours, lecture/pause, volume."),
  tool("get_queue", "Liste les prochains morceaux de la file d'attente."),
  tool("pause", "Met la lecture en pause."),
  tool("resume", "Relance la lecture."),
  tool("skip", "Passe au morceau suivant."),
  tool("set_volume", "Règle le volume (0-100).", { percent: { type: "number" } }, ["percent"]),
  tool("get_playlists", "Liste les playlists de l'auditeur."),
  tool("get_playlist_tracks", "Liste les morceaux d'une playlist (id issu de get_playlists).", { playlist_id: str }, ["playlist_id"]),
  tool("get_liked_tracks", "Liste les derniers titres likés de l'auditeur — sa base de goûts."),
  tool("save_track", "Like un morceau pour l'auditeur (URI issue d'une recherche ou de l'état de lecture).", { uri: str }, ["uri"]),
  tool("add_to_playlist", "Ajoute un morceau à une playlist de l'auditeur.", { playlist_id: str, uri: str }, ["playlist_id", "uri"]),
  tool("lastfm_similar_artists", "Artistes proches d'un artiste donné (données d'écoute réelles Last.fm).", { artist: str }, ["artist"]),
  tool("lastfm_similar_tracks", "Morceaux proches d'un morceau donné (Last.fm).", { artist: str, track: str }, ["artist", "track"]),
  tool("lastfm_tags", "Genres/tags principaux d'un artiste (Last.fm).", { artist: str }, ["artist"]),
];

export async function dispatch(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "search_spotify": return JSON.stringify(slim(await sp.searchTracks(args.query)));
      case "play_track": await sp.ensureActiveDevice(); await sp.playTrack(args.uri); return "OK, lecture lancée";
      case "add_to_queue": await sp.ensureActiveDevice(); await sp.addToQueue(args.uri); return "OK, ajouté à la file";
      case "get_playback_state": return JSON.stringify(await sp.getPlaybackState());
      case "get_queue": return JSON.stringify(slim(await sp.getQueue()));
      case "pause": await sp.ensureActiveDevice(); await sp.pause(); return "OK";
      case "resume": await sp.ensureActiveDevice(); await sp.resume(); return "OK";
      case "skip": await sp.ensureActiveDevice(); await sp.skipNext(); return "OK";
      case "set_volume": await sp.setVolume(args.percent); return "OK";
      case "get_playlists": return JSON.stringify(await sp.getPlaylists());
      case "get_playlist_tracks": return JSON.stringify(slim(await sp.getPlaylistTracks(args.playlist_id)));
      case "get_liked_tracks": return JSON.stringify(slim(await sp.getLikedTracks(30)));
      case "save_track": await sp.saveTrack(sp.trackIdFromUri(args.uri)); return "OK, liké";
      case "add_to_playlist": await sp.addToPlaylist(args.playlist_id, args.uri); return "OK, ajouté";
      case "lastfm_similar_artists": return JSON.stringify(await fm.similarArtists(args.artist));
      case "lastfm_similar_tracks": return JSON.stringify(await fm.similarTracks(args.artist, args.track));
      case "lastfm_tags": return JSON.stringify(await fm.topTags(args.artist));
      default: return `Outil inconnu: ${name}`;
    }
  } catch (e) {
    return `Erreur outil ${name}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
```

- [ ] **Step 4: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent && git commit -m "feat: outils du Comte — définitions + dispatcher"
```

### Task 17: Persona + boucle d'agent (TDD)

**Files:**
- Create: `src/lib/agent/persona.ts`, `src/lib/agent/loop.ts`
- Test: `src/lib/agent/loop.test.ts`

**Interfaces:**
- Consumes: `chat`, types (Task 14), `TOOL_DEFS`, `dispatch` (Task 16).
- Produces: `PERSONA: string` ; `runAgent(history: ChatMessage[]): Promise<ChatMessage[]>` — history SANS message système (ajouté en interne), retourne le history enrichi, dernier message = réponse assistant.

- [ ] **Step 1: Écrire `src/lib/agent/persona.ts`**

```typescript
export const PERSONA = `Tu es Le Comte, animateur radio de "Good Morning Earth", la radio personnelle de ton unique auditeur.

PERSONNAGE : érudit, chaleureux, un brin théâtral. Tu tutoies l'auditeur. Tu parles français. Tes réponses sont courtes (2-4 phrases) — tu es à l'antenne, pas en conférence. Tu glisses volontiers une anecdote ou un détail d'histoire musicale, jamais inventé : si tu n'es pas sûr, tu n'affirmes pas.

TON MÉTIER : construire une écoute cohérente. Pour choisir des morceaux, tu croises trois sources : les goûts de l'auditeur (get_liked_tracks, get_playlists), les similarités réelles (outils lastfm_*), et ta propre culture. Tu programmes au fil de l'eau : 2-3 morceaux d'avance dans la file, jamais plus.

RÈGLES ABSOLUES :
- Toute URI de morceau vient d'un résultat search_spotify de cette conversation. Tu n'inventes JAMAIS une URI.
- Si un morceau est introuvable, dis-le et propose autre chose.
- Avant de bouleverser l'ambiance (changer de genre, vider l'énergie), demande confirmation.
- Quand tu as fini tes actions, réponds à l'auditeur en une ou deux phrases : ce que tu as lancé et pourquoi.`;
```

- [ ] **Step 2: Écrire le test qui échoue**

```typescript
// src/lib/agent/loop.test.ts
import { it, expect, vi } from "vitest";

vi.mock("./ollama", () => ({ chat: vi.fn() }));
vi.mock("./tools", () => ({ TOOL_DEFS: [], dispatch: vi.fn().mockResolvedValue('[{"uri":"spotify:track:1"}]') }));

import { chat } from "./ollama";
import { dispatch } from "./tools";
import { runAgent } from "./loop";

it("exécute les tool calls puis retourne la réponse finale", async () => {
  (chat as any)
    .mockResolvedValueOnce({
      role: "assistant", content: null,
      tool_calls: [{ id: "c1", function: { name: "search_spotify", arguments: '{"query":"miles"}' } }],
    })
    .mockResolvedValueOnce({ role: "assistant", content: "Voilà du Miles Davis." });

  const history = await runAgent([{ role: "user", content: "mets du jazz" }]);

  expect(dispatch).toHaveBeenCalledWith("search_spotify", { query: "miles" });
  expect(history.at(-1)).toEqual({ role: "assistant", content: "Voilà du Miles Davis." });
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
  expect(history.at(-1)?.role).toBe("assistant");
  expect(history.at(-1)?.content).toBeTruthy(); // message de repli, pas null
});
```

- [ ] **Step 3: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 4: Écrire `src/lib/agent/loop.ts`**

```typescript
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
```

- [ ] **Step 5: Vérifier le pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent && git commit -m "feat: persona + boucle d'agent Le Comte"
```

### Task 18: Brancher Le Comte au chat ✋

**Files:**
- Create: `src/hooks/useComte.ts`
- Modify: `src/App.tsx` (remplacer l'état provisoire de la Task 13)

**Interfaces:**
- Consumes: `runAgent` (Task 17), `OllamaDownError` (Task 14), `UiMessage` (Task 13).
- Produces: `useComte(): { messages: UiMessage[]; busy: boolean; send(text: string): void; pushComte(text: string): void }` — `pushComte` sert au mode animateur (Task 19).

- [ ] **Step 1: Écrire `src/hooks/useComte.ts`**

```typescript
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
      const last = history.current.at(-1);
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
```

- [ ] **Step 2: Remplacer l'état provisoire dans `App.tsx`**

```tsx
const { messages, busy, send, pushComte } = useComte();
// JSX :
<section className="zone-chat"><Chat messages={messages} busy={busy} onSend={send} /></section>
```

(`pushComte` reste inutilisé jusqu'à la Task 19 — préfixer `_pushComte` si le lint râle.)

- [ ] **Step 3: Validation E2E manuelle** ✋ CHECKPOINT avec l'utilisateur

Run: `npm run tauri dev` (Ollama lancé). Scénarios :
1. « Mets-moi du jazz modal des années 50 » → Le Comte cherche, met en file, répond.
2. « C'est quoi ce morceau ? » → il lit l'état de lecture et raconte.
3. « Monte un peu le son » → volume change.
4. Couper Ollama (`brew services stop ollama`) → message d'erreur clair, lecteur toujours fonctionnel.

Expected: les 4 scénarios passent. Ajuster `PERSONA` avec l'utilisateur si le ton ne va pas.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: Le Comte branché au chat"
```

---

## Phase 6 — Mode animateur

### Task 19: Interventions au changement de morceau (TDD)

**Files:**
- Create: `src/lib/agent/announcer.ts`
- Test: `src/lib/agent/announcer.test.ts`
- Modify: `src/App.tsx` (toggle + branchement poller)

**Interfaces:**
- Consumes: `chat` (Task 14), `PERSONA` (Task 17), `startPoller` (Task 10), `pushComte` (Task 18).
- Produces: `announceTrack(track: Track, previous: Track | null): Promise<string>`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/agent/announcer.test.ts
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
  const prompt = messages.at(-1).content as string;
  expect(prompt).toContain("So What");
  expect(prompt).toContain("Blue in Green");
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Écrire `src/lib/agent/announcer.ts`**

```typescript
import { chat } from "./ollama";
import { PERSONA } from "./persona";
import type { Track } from "../spotify/types";

export async function announceTrack(track: Track, previous: Track | null): Promise<string> {
  const msg = await chat(
    [
      { role: "system", content: PERSONA },
      {
        role: "user",
        content:
          `[ANTENNE] "${track.name}" de ${track.artists} démarre` +
          (previous ? ` juste après "${previous.name}" de ${previous.artists}` : "") +
          `. Fais une intervention d'antenne de 2-3 phrases maximum : anecdote, contexte ou transition. ` +
          `Rien d'inventé — si tu ne sais rien de sûr sur ce morceau, parle de l'ambiance. Pas de question à l'auditeur.`,
      },
    ],
    [], // pas d'outils : intervention pure, rapide
  );
  return msg.content ?? "";
}
```

- [ ] **Step 4: Brancher dans `App.tsx`**

```tsx
const [radioMode, setRadioMode] = useState(true);
const radioModeRef = useRef(radioMode);
radioModeRef.current = radioMode;

useEffect(() => {
  if (!authed) return;
  return startPoller({
    onState: setPlayback,
    onTrackChange: (track, previous) => {
      if (!radioModeRef.current || !previous) return; // pas d'intervention au premier tick
      announceTrack(track, previous).then(pushComte).catch(() => {});
    },
  });
}, [authed]);
// dans le JSX du chat, un toggle :
<label className="radio-toggle">
  <input type="checkbox" checked={radioMode} onChange={(e) => setRadioMode(e.target.checked)} />
  Mode animateur
</label>
```

- [ ] **Step 5: Vérifier le pass + E2E** — Run: `npm test` — Expected: PASS. Puis `npm run tauri dev` : laisser deux morceaux s'enchaîner → intervention du Comte dans le chat ; désactiver le toggle → silence.

- [ ] **Step 6: Commit**

```bash
git add src && git commit -m "feat: mode animateur — interventions au changement de morceau"
```

### Task 20: Vérification finale ✋

- [ ] **Step 1: Suite complète** — Run: `npm test && npx tsc --noEmit` — Expected: tout PASS, zéro erreur TS.
- [ ] **Step 2: Parcours complet E2E avec l'utilisateur** ✋ CHECKPOINT — login à froid, bibliothèque, recherche, chat, programmation d'ambiance par Le Comte, mode animateur, coupure/reprise d'Ollama.
- [ ] **Step 3: Commit final + tag**

```bash
git add -A && git commit -m "chore: v1 complète" && git tag v1.0.0
```
