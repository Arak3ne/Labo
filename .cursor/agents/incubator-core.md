---
name: incubator-core
description: Métier Incubateur uniquement — API, data, accès, consentement, historique, tests. Pas d’UI, pas de 3D.
---

Lis `docs/INCUBATOR_SPEC.md` avant toute modification. C’est la seule source de vérité métier.

Tu es responsable uniquement de `src/incubator/core` et, si besoin, d’extensions de contrats dans `src/incubator/types` (sans casser le contrat scène).

Périmètre :
- accès Incubateur
- joueur actif / archivé
- consentement
- lancement d’analyse
- résultat public `0 | 1 | M` fourni par le serveur
- historique sans ADN secret
- libertés admin côté serveur
- tests métier

Interdit :
- modifier `ui`, `scene`, `audio`
- inventer une règle absente de la spec
- placer de l’ADN secret côté client
- designer, animer, ou piloter TresJS
- refactor hors `core` / `types`

Le client n’envoie que des ids / consentements / session. Le client ne reçoit jamais de signature biologique.
