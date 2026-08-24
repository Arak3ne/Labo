# Incubateur — source de vérité

Document commun pour tous les subagents. Ne pas inventer de règle hors de ce fichier. Ne pas implémenter depuis cette spec seule.

## Contexte — Le Laboratoire des Morues

Expérience sociale / compétitive en ligne : **16 joueurs**, **plusieurs semaines**.

Mélange : épreuves, éliminations, crédits, alliances / négociations, informations secrètes, ADN cachés, Incubateur, Protocole final.

Univers : laboratoire expérimental futuriste, sombre, mystérieux, premium. L’app est un **système du Laboratoire**, pas un site web classique.

Stack figée : Vue 3, TypeScript, Vite, TresJS / Three.js, `@tresjs/cientos`, `@tresjs/post-processing`, GSAP, Howler, GLSL, GLB/glTF. Rive seulement si utile. ESLint existant. Ne pas réinstaller ni remplacer la stack sans nécessité.

## Rôle de l’Incubateur

Mécanique signature. Deux cobayes sont introduits dans une machine. Le serveur compare **secrètement** leurs signatures biologiques. Le système public ne renvoie **que** `0`, `1` ou `M`.

La mise en scène (3D, machine, caméra, scans, particules, lumière, hologrammes, cinématique, sound design) est spectaculaire. Elle n’est pas le métier.

## Règle absolue — aucun ADN secret côté client

- Aucun allèle, génotype, signature brute, score interne ou table de correspondance secrète dans le client, le localStorage, les assets, les shaders, les logs navigateur ou l’historique UI.
- Le client envoie des **identifiants** de cobayes (et preuves de consentement / session).
- Le client reçoit uniquement : identités d’affichage, statuts, consentements, code `0 | 1 | M`, métadonnées de run (dates, acteur, ids).
- La comparaison s’exécute **uniquement côté serveur** (`core` / API). `scene`, `ui`, `audio` n’infèrent jamais le code.

## Règles métier validées

1. Un run Incubateur = **exactement deux** cobayes.
2. Sortie publique d’un run abouti = **un seul** code parmi `0`, `1`, `M`.
3. Le code n’est pas calculé, deviné ni “preview” côté client.
4. Tout joueur a un statut **actif** ou **archivé**.
5. Un run exige un **consentement** enregistré avant analyse (sauf liberté admin, voir plus bas).
6. L’**accès** à lancer un run est décidé par `core`, jamais par l’UI seule.
7. Chaque run abouti est **historisé** sans payload ADN.
8. L’**administrateur** peut outrepasser des contraintes joueur ; pas la règle ADN secret.
9. Hors ce document : ne pas inventer coûts, quotas, sémantique narrative de `0/1/M`, ni règles d’élimination.

## Joueur actif / archivé

| Statut | Sens |
|---|---|
| `actif` | En lice. |
| `archivé` | Hors lice (éliminé ou retiré). L’identité reste dans le Laboratoire. |

- Le statut est une donnée `core`. UI et scène l’affichent / le filtrent, elles ne le changent pas.
- Un archivé reste sélectionnable comme cobaye si `core` l’autorise.
- Les transitions actif → archivé viennent des autres mécaniques (éliminations, etc.), pas de l’Incubateur.

## Accès Incubateur

- Surface client : route `/incubateur`.
- `core` autorise ou refuse : ouvrir le système, sélectionner des cobayes, lancer l’analyse.
- UI, scène et audio n’ont pas de backdoor d’accès.
- Un refus `core` arrête le flux (pas d’analyse, pas de reveal métier).

## Consentement

- Avant `startAnalysis` métier : consentement **explicite** et **persisté** pour le run (opérateur + cobayes concernés, selon ce que `core` exige).
- Sans consentement valide : pas d’analyse, pas de résultat.
- La scène n’appelle un scan “réel” que lorsque `core` confirme le consentement.
- Consentement et statut (actif / archivé) sont indépendants.

## Résultats `0` / `1` / `M`

- Seuls codes publics possibles.
- Le client **affiche** le code ; il n’en calcule pas la signification secrète.
- `revealResult` ne s’exécute qu’avec un code fourni par `core` après analyse serveur.
- Pas d’autre sortie (`null`, pourcentage, texte ADN, “match” interne, etc.).

## Historique

Chaque run abouti conserve au minimum :

- id du run
- ids des deux cobayes
- code `0 | 1 | M`
- horodatage
- acteur (joueur ou admin)
- preuves / ids de consentement

Interdit dans l’historique client ou les payloads front : toute donnée ADN secrète.

L’UI peut lister l’historique. La scène ne rejoue un reveal qu’à partir d’un code déjà historisé ou d’un nouveau run `core`.

## Libertés administrateur

L’admin, **autorisé côté serveur**, peut notamment :

- accéder à l’Incubateur hors contraintes d’accès joueur
- forcer ou ignorer un consentement joueur
- lancer un run impliquant actifs et/ou archivés
- relancer / corriger un run et son historique

Limites :

- aucun ADN secret dans le client admin
- le résultat public reste `0 | 1 | M`
- la scène reste pilotée par le même contrat

## Séparation des modules

| Module | Responsable de | Interdit |
|---|---|---|
| `core` | métier, API, auth, consentement, accès, historique, tests | UI, 3D, audio, shaders |
| `ui` | écrans Vue, sélection, consentement visible, historique, états | calcul ADN, machine 3D, règles serveur |
| `scene` | TresJS / Three.js, caméra, FX, hologrammes, cinématique | métier, secrets, appels API de décision |
| `audio` | Howler, cues liés aux états scène | métier, secrets |
| `integration` | brancher core + ui + scene + audio, polish | inventer des règles, élargir les contrats |
| `types` | contrats partagés uniquement | logique |

Chemins : `src/incubator/{core,ui,scene,audio,types}`.

Flux : `ui` → `core` (demande) → `core` (autorisation + code) → `ui` orchestre → `scene` / `audio` exécutent le contrat.

## Contrat scène

`scene` expose exactement :

```ts
idle()
focusLeft()
focusRight()
loadSubjects()
startAnalysis()
revealResult(code: '0' | '1' | 'M')
reset()
```

- Implémentations no-op acceptables tant que la machine finale n’est pas dans le scope.
- `revealResult` n’accepte que `'0' | '1' | 'M'`.
- `integration` / `ui` sont les seuls à piloter ces méthodes d’après l’état `core`.
- `scene` ne décide pas du code.
