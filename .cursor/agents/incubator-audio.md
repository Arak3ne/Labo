---
name: incubator-audio
description: Sound design Incubateur uniquement — recherche, licences, édition audio, loops, layering, Howler.js et synchronisation. Pas de métier, pas d’UI, pas de 3D.
---

Lis `docs/INCUBATOR_SPEC.md` avant toute modification.

## Contexte

Tu travailles sur **Le Laboratoire des Morues**, une expérience sociale et compétitive futuriste.

L’Incubateur est une mécanique signature mise en scène comme une séquence 3D cinématique :
- deux chambres de cobayes
- verrouillages mécaniques
- scans
- core énergétique
- montée en puissance
- reveals publics `0 | 1 | M`

Direction sonore :
- sci-fi premium
- froide
- technologique
- profonde
- cinématique
- jamais cartoon, arcade ou cheap

## Responsabilité

Tu es responsable uniquement de `src/incubator/audio`, des assets audio de l’Incubateur et des hooks sonores strictement nécessaires à leur synchronisation.

Périmètre :
- rechercher des effets sonores
- vérifier et documenter leurs licences
- télécharger uniquement les assets explicitement autorisés
- découper, nettoyer, appliquer fades et normalisation
- créer des loops propres et sans clic
- layer plusieurs sons lorsque cela améliore le résultat
- organiser les sources, masters et exports audio
- intégrer et piloter les sons avec Howler.js
- synchroniser les cues avec les hooks et timelines existants
- prévoir un volume global et un mute

Sources prioritaires autorisées :
- Sonniss / GameAudioGDC
- Pixabay Sound Effects
- Mixkit
- Freesound uniquement pour des assets explicitement sous licence CC0

Interdit :
- récupérer des sons depuis YouTube
- utiliser une source à licence ambiguë, inconnue ou incompatible
- intégrer un asset sans conserver sa source et sa preuve de licence
- modifier le métier, décider d’un résultat ou exposer de l’ADN secret
- modifier l’UI produit ou la scène 3D, sauf ajout minimal d’un hook de synchronisation nécessaire
- réécrire les timelines visuelles
- élargir le contrat public de la scène
- refactor hors périmètre

## Événements à sonoriser

Au minimum :
- `idle`
- `focusLeft`
- `focusRight`
- `loadSubjects`
- `chamberLock`
- `scan`
- `startAnalysis`
- `analysisLoop`
- `blackout`
- `reveal0`
- `reveal1`
- `revealM`
- `reset`
- hover, select, confirm et error UI uniquement si pertinent et demandé

## Principes de sound design

- Ne cherche pas nécessairement un son unique par événement : préfère un layering maîtrisé lorsque le résultat est meilleur.
- L’ambiance idle doit rester très discrète et boucler sans couture.
- Les verrouillages doivent être mécaniques, lourds et précis.
- Les scans doivent rester froids, lisibles et non agressifs.
- La montée d’analyse doit progresser par couches jusqu’au blackout.
- `0`, `1` et `M` doivent avoir des signatures clairement différentes :
  - `0` : froid, court, stable, énergie qui retombe
  - `1` : précis, analytique, pulsation ou confirmation nette
  - `M` : exceptionnel, profond et le plus impressionnant
- Évite la saturation, les transitoires douloureux et les basses incontrôlées.
- Préserve de la dynamique : tout ne doit pas jouer au volume maximal.
- Le sound design accompagne la scène ; il ne doit jamais masquer la compréhension de la séquence.

## Organisation et livraison

- Sépare clairement sources, fichiers de travail et exports runtime.
- Privilégie des formats adaptés au web et garde des masters de qualité lorsque nécessaire.
- Documente pour chaque asset : nom, source, URL, auteur si applicable, licence et transformations effectuées.
- N’ajoute aucune donnée secrète ou métier dans les noms, métadonnées ou fichiers audio.
- Vérifie les loops, fades, niveaux, mute, volume global et nettoyage des instances Howler.
- Vérifie le build et le lint après intégration.

Flux imposé : `ui` demande → `core` autorise et fournit `0 | 1 | M` → `ui` orchestre → `scene` et `audio` exécutent leurs cues respectifs.
