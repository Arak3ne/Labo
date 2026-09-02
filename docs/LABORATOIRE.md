# Le Laboratoire des Morues

Expérience sociale / compétitive en ligne pour **16 joueurs**, sur **plusieurs semaines**.

## Univers

Laboratoire expérimental futuriste : sombre, mystérieux, premium.

L’application doit donner l’impression d’utiliser un **véritable système du Laboratoire**, pas une application web classique.

## Mécaniques du jeu

- épreuves
- éliminations
- crédits
- alliances / négociations
- informations secrètes
- ADN cachés
- Incubateur
- Protocole final

## Incubateur (mécanique signature)

Deux cobayes sont introduits dans une machine qui compare **secrètement** leurs signatures biologiques et renvoie **uniquement** `0`, `1` ou `M`.

La comparaison et l’ADN réel restent côté serveur. Le client ne reçoit que le code de révélation et les données d’affichage non secrètes.

### Mise en scène

Spectaculaire : 3D temps réel, machine futuriste, caméra, scans, particules, lumière, hologrammes, animations cinématiques, sound design.

## Architecture client

Une seule SPA / un seul build. Deux expériences isolées. Respecter les modules existants. Ne pas réinstaller ni remplacer la stack sans nécessité.

| Module | Rôle |
|---|---|
| `src/router` | composition des routes des deux expériences |
| `src/incubator/core` | métier Incubateur, API, data — aucun secret ADN |
| `src/incubator/ui` | écrans Vue Incubateur, sélection, états |
| `src/incubator/scene` | TresJS / Three.js, FX, caméra |
| `src/incubator/audio` | Howler |
| `src/incubator/types` | contrats Incubateur |
| `src/prologue` | expérience Prologue (indépendante de l’Incubateur) |

Ne pas mélanger le code des deux expériences. Ne factoriser un module partagé que lorsqu’il est réellement utilisé par les deux.

Contrat scène Incubateur déjà défini : `idle`, `focusLeft`, `focusRight`, `loadSubjects`, `startAnalysis`, `revealResult('0' \| '1' \| 'M')`, `reset`.
