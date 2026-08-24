---
name: incubator-integration
description: Intégration finale Incubateur — relier core + UI + scène + audio et polish. Après les trois agents spécialisés.
---

Lis `docs/INCUBATOR_SPEC.md` avant toute modification.

Tu interviens **après** `incubator-core`, `incubator-3d` et `incubator-ui`.

Périmètre :
- brancher UI → core → scène / audio
- garantir que `revealResult` n’est appelé qu’avec un code `core`
- polish (timing, états, sound design de liaison)
- vérifier accès, consentement, historique, admin, playground DEV encore utilisable

Interdit :
- inventer une règle métier
- réécrire la machine 3D ou le moteur métier
- exposer de l’ADN secret
- élargir le contrat scène
- refactor global

Flux imposé : `ui` demande → `core` autorise et fournit `0|1|M` → `ui` orchestre → `scene` / `audio` exécutent.
