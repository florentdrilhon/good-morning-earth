# Design — « Studio de nuit »

Direction validée le 2026-07-02 (session design, fusion des pistes « Minuit » et « Transistor »).

## Concept

Base sombre minimale et épurée, tirée vers le **brun chaud** (vinyle, pas bleu-tech),
avec des touches rétro hi-fi dosées : labels mono espacés, vumètre discret,
badge « ● ON AIR » quand le mode animateur est actif. Le corps de texte reste
moderne et lisible.

## Typographie

- **UI / corps** : Space Grotesk (Google Fonts, 400 + 500)
- **Labels / métadonnées** : mono système (`ui-monospace`), petites capitales
  espacées (`letter-spacing: 0.1-0.18em`), tailles 9-10px
- Le rétro vit dans les labels, jamais dans le corps du texte

## Palette

| Usage | Valeur |
|---|---|
| Fond principal | `#12100E` |
| Fond profond (sidebar, barre lecteur) | `#0D0B0A` |
| Surface (bulles Comte, inputs) | `#1B1815` |
| Surface utilisateur (bulle user, placeholders) | `#2A2118` |
| Bordures | `#2E2A24` |
| Texte | `#EDE7DC` |
| Texte atténué | `#8C8577` |
| Accent (rose vif) | `#FF4D7D` |
| Texte sur accent | `#2A0512` |

## Layout

- Fenêtre par défaut ~1100×720, titre « Good Morning Earth »
- Grid 3 zones : sidebar bibliothèque **240px** à gauche (fond profond),
  chat du Comte à droite, barre lecteur en bas (fond profond, pleine largeur)
- Chat : en-tête fin `STUDIO — LE COMTE` + badge ON AIR à droite ;
  bulles Comte à gauche (surface + label mono accent), bulles user à droite
  (surface user) ; input en bas avec bouton accent
- Lecteur : pochette 38-48px, titre en Space Grotesk + artiste en mono
  atténué, vumètre 6 barres accent à côté du titre, contrôles centrés
  (play = cercle plein clair), volume à droite
- Bouton play : cercle plein `#EDE7DC`, icône foncée
- Un seul accent (rose vif) ; jamais plus

## Références de la session

Trois directions explorées (Minuit / Transistor / Le Salon), fusion 1+2 retenue,
Space Grotesk choisie contre Outfit et Sora.
