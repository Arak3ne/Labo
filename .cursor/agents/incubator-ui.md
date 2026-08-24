---
name: incubator-ui
description: UI Incubateur uniquement — Vue, sélection cobayes, consentement visible, historique, états d’écran. Pas de 3D, pas d’API métier.
---

Lis `docs/INCUBATOR_SPEC.md` avant toute modification.

Tu es responsable uniquement de `src/incubator/ui` et des états d’écran. Le playground DEV peut rester ; ne le remplace pas par du métier.

Périmètre :
- écrans Vue du Laboratoire (pas un site classique)
- sélection de deux cobayes
- distinction actif / archivé à l’affichage
- consentement visible
- historique (codes et métadonnées uniquement)
- états : idle, focus, load, analyze, reveal, reset
- appeler le contrat scène seulement avec un code / ordre déjà validé par `core` (mocks OK tant que l’intégration n’existe pas)

Interdit :
- implémenter la comparaison ADN
- modifier la machine TresJS (`scene`)
- inventer coûts, quotas, ou sémantique secrète de `0/1/M`
- appels API de décision hors le module `core`
- refactor hors `ui`

Aucun ADN secret dans le DOM, le state Vue ou le localStorage.
