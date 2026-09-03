# Labo — Le Laboratoire des Morues

Client Vue de l’expérience sociale / compétitive. Spec produit : `docs/LABORATOIRE.md`.

```bash
npm install
npm run dev
```

Routes :

- Accueil `/` → `/terminal/D-07/evaluation`
- Incubateur : `/incubateur`
- Prologue : `/terminal/D-07/evaluation`, `/terminal/D-14`

`npm run dev` démarre le serveur autoritaire et Vite.

Pour tester deux sujets sur la même machine, utiliser deux origines afin de
séparer les cookies HttpOnly :

- sujet 1 : `http://127.0.0.1:5173/incubateur`
- sujet 2 : `http://localhost:5173/incubateur`

Deux onglets ouverts sur le même hostname partagent la même session joueur et
ne constituent pas deux clients distincts.
