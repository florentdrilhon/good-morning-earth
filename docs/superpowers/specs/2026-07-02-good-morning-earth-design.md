# Good Morning Earth — Design v1

**Date** : 2026-07-02
**Statut** : validé (brainstorming du 2026-07-02)

## Résumé

App macOS perso, wrapper de Spotify, intégrant « Le Comte » : un agent IA
animateur radio qui gère la file d'attente, fait découvrir des morceaux et
raconte des anecdotes. 100 % gratuit : LLM local via Ollama, APIs gratuites.

## Décisions structurantes

| Sujet | Décision |
|---|---|
| Compte Spotify | Premium (requis pour le contrôle de lecture via API) |
| Cible | Usage perso uniquement (mode dev Spotify, pas de distribution) |
| Le Comte v1 | Texte uniquement (chat) — la voix est une porte ouverte v2 |
| Stack | Tauri v2 + React/TypeScript |
| Lecture audio | **Approche « télécommande »** : l'app Spotify officielle joue le son, notre app la pilote via l'API Web / Spotify Connect. Pas de Web Playback SDK (DRM Widevine impossible en Tauri, usine à gaz en Electron via fork castlabs, et aucun chemin vers Android). |
| LLM | Ollama local (`qwen3:14b` ou proche), endpoint OpenAI-compatible → backend interchangeable |
| Connaissance musicale | Recherche Spotify + Last.fm (similarités, tags) + culture du LLM. Les endpoints reco/audio-features/related-artists de Spotify sont **dépréciés pour les nouvelles apps** (nov. 2024) — non utilisables. |
| Android (futur) | Non construit, mais architecture compatible : Tauri v2 supporte Android, l'App Remote SDK Android suit la même philosophie « télécommande », toute l'intelligence reste en TypeScript. |

## Architecture

```
┌─────────────────────────── App Tauri v2 ───────────────────────────┐
│  Frontend React/TypeScript (toute l'intelligence vit ici)          │
│                                                                     │
│  ┌──────────┐  ┌────────────────┐  ┌───────────────────────────┐   │
│  │ UI       │  │ Client Spotify │  │ Agent « Le Comte »        │   │
│  │ lecteur  │←→│ (API Web,      │←→│ boucle tool-calling       │   │
│  │ biblio   │  │  OAuth PKCE)   │  │ persona + outils          │   │
│  │ chat     │  └───────┬────────┘  └─────┬──────────┬──────────┘   │
│  └──────────┘          │                 │          │              │
│  Couche Rust : quasi vide (fenêtre, keychain, lancer Spotify.app)  │
└────────────────────────┼─────────────────┼──────────┼──────────────┘
                         ↓ HTTPS           ↓ HTTP     ↓ HTTPS
                  API Web Spotify    Ollama (local)   Last.fm API
                         ↓ (Spotify Connect)
                  App Spotify officielle (arrière-plan) → 🔊 le son
```

Briques externes (toutes gratuites) :
- App Spotify Developer (client ID, mode dev, utilisateur unique)
- Ollama + modèle avec bon tool-calling (`qwen3:14b` cible, M5 / 32 Go OK)
- Clé API Last.fm
- App Spotify macOS officielle installée

## Composants

### Client Spotify (TypeScript)

- OAuth **Authorization Code + PKCE** (pas de client secret). Token dans le
  keychain macOS, refresh automatique.
- Endpoints utilisés : player state, play/pause/next/previous, volume,
  add to queue, transfer playback, search, playlists de l'utilisateur,
  titres likés, save track, add to playlist.
- Pas de push dans l'API Web → **polling de l'état du lecteur toutes les ~3 s**
  pour détecter les changements de morceau.
- Contrainte API : la queue est **append-only** (pas de retrait/réordonnancement).
  Le Comte programme au fil de l'eau, 2-3 morceaux d'avance maximum.

### UI

Une fenêtre, trois zones :
- **Barre lecteur** (bas) : pochette, titre/artiste, contrôles, volume.
- **Bibliothèque / recherche** (gauche) : playlists, titres likés, résultats.
- **Chat Le Comte** (droite) : conversation + interventions du mode animateur.

Hors scope : playlists éditoriales Spotify, podcasts, vidéos.

### Agent « Le Comte » (TypeScript)

Boucle de tool-calling standard contre l'endpoint OpenAI-compatible d'Ollama.

Outils :

| Outil | Rôle |
|---|---|
| `search_spotify` | trouver morceaux/artistes/albums |
| `add_to_queue` / `play_track` | programmer la lecture |
| `get_playback_state` / `get_queue` | connaître l'état courant |
| `pause` / `resume` / `skip` / `set_volume` | contrôles |
| `get_playlists` / `get_playlist_tracks` / `get_liked_tracks` | goûts de l'utilisateur |
| `save_track` / `add_to_playlist` | enregistrer un coup de cœur |
| `lastfm_similar_artists` / `lastfm_similar_tracks` / `lastfm_tags` | similarités et genres objectifs |

Persona (prompt système) : animateur radio français, érudit, chaleureux —
ton à affiner à l'usage. Méthode imposée par le prompt : croiser les goûts de
l'utilisateur, Last.fm et sa culture ; programmer peu et souvent.

**Règle anti-hallucination** : toute URI Spotify mise en queue provient d'un
résultat `search_spotify` réel, jamais du modèle.

### Mode animateur

Sur détection d'un nouveau morceau (polling), Le Comte poste une courte
intervention texte dans le chat (anecdote, contexte, transition).
Toggle on/off dans l'UI.

### Couche Rust (Tauri)

Volontairement minimale : fenêtre, stockage keychain, commande « lancer
Spotify.app ». Toute logique métier reste en TypeScript (portabilité Android).

## Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Aucun appareil Spotify actif | Lancer `Spotify.app` (couche Rust) puis transfer playback |
| Token expiré | Refresh silencieux ; si refresh token invalide → relancer OAuth |
| Ollama éteint | Message clair dans le chat (commande de relance) ; lecteur et bibliothèque restent fonctionnels |
| Rate limit Spotify (429) | Backoff ; polling 3 s largement sous les limites |
| Morceau introuvable | Le Comte le dit et propose autre chose (jamais d'URI inventée) |

## Tests

Ciblés, légers (app perso) :
- **Vitest** sur la boucle d'agent (parsing tool-calls, enchaînements) et le
  client Spotify (refresh, mapping des réponses), API mockée.
- UI et intégration réelle : validation manuelle.

## Hors scope v1 (portes ouvertes)

Voix/TTS, version Android, podcasts/vidéos, multi-utilisateurs, playlists
éditoriales. Aucune décision v1 ne les ferme.
