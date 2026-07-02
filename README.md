# Good Morning Earth

Wrapper Spotify macOS avec Le Comte, animateur radio IA local.

## Prérequis

- macOS, app Spotify officielle installée, compte Spotify Premium
- Ollama (`brew install ollama && brew services start ollama && ollama pull qwen3:14b`)
- `.env.local` avec `VITE_SPOTIFY_CLIENT_ID` (app sur developer.spotify.com,
  redirect URI `http://127.0.0.1:8898`) et `VITE_LASTFM_API_KEY`

## Dev

```
npm install
npm run tauri dev
```

## Tests

```
npm test
```
