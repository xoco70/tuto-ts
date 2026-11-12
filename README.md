# Parcours Fullstack TypeScript

Tutoriel + quiz en français pour monter en compétence sur **TypeScript**, **NestJS** et **React**, jusqu'au niveau attendu pour un poste de **développeur fullstack senior**.

- 26 étapes progressives (TypeScript → NestJS → React → Fullstack senior), toutes accessibles librement
- Un cours par étape, puis un quiz tiré au hasard dans un pool de questions (plus de 550 au total)
- Chaque réponse est expliquée, avec le cours de référence et un lien vers la documentation (en français quand elle existe)
- Tirage pondéré : les questions jamais vues et celles ratées reviennent en priorité
- Examen blanc mélangeant les parcours
- Progression stockée dans le navigateur (localStorage)

## Lancer

```bash
npm install
npm run dev
```

`npm run build` vérifie le contenu (`npm run check`), les types, puis construit le site statique dans `dist/`.

## Ajouter du contenu

Chaque étape est un fichier Markdown dans `src/content/<parcours>/`. Le cours est en haut, les questions après `<!-- QUIZ -->` :

```markdown
### Énoncé (blocs de code autorisés)
- [ ] mauvaise réponse
- [x] bonne réponse          (plusieurs [x] = choix multiples)
> Explication (obligatoire)
[doc]: Libellé du lien | https://lien-vers-la-doc   (obligatoire, plusieurs possibles)
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie sur GitHub Pages à chaque push sur `main` (activer *Settings → Pages → Source : GitHub Actions*).
