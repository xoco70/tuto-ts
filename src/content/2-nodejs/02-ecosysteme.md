---
id: node-ecosysteme
track: nodejs
order: 2
title: L'écosystème Node.js — npm, frameworks, outillage
level: Intermédiaire
summary: Gestionnaires de paquets, semver et lockfiles, sécurité de la chaîne d'approvisionnement, frameworks HTTP, ORM, tests, outillage et runtimes alternatifs (Deno, Bun).
---

## Gestionnaires de paquets

| Outil | Points clés |
| --- | --- |
| **npm** | livré avec Node ; `npm ci` pour la CI ; workspaces |
| **pnpm** | store global + liens : rapide et économe en disque ; `node_modules` **strict** (pas d'accès aux dépendances non déclarées) ; référence des monorepos |
| **Yarn** (v4, « Berry ») | Plug'n'Play optionnel, workspaces avancés |
| **Bun** | `bun install` très rapide, compatible `package.json` |

Le champ `packageManager` (`"pnpm@10.x"`) fixe l'outil et sa version pour toute l'équipe. **Corepack**, qui l'appliquait automatiquement, n'est plus distribué avec Node depuis la v25 : il s'installe à part (`npm i -g corepack`), ou l'on installe l'outil directement.

## `package.json`, semver et lockfile

```json
{
  "dependencies": {
    "fastify": "^5.2.0",
    "zod": "~4.1.0",
    "pino": "9.6.0"
  },
  "devDependencies": { "vitest": "^4.0.0" },
  "peerDependencies": { "react": ">=18" },
  "engines": { "node": ">=22" }
}
```

**Semver** : `MAJEUR.MINEUR.CORRECTIF` — majeur = rupture, mineur = ajout compatible, correctif = bugfix.

| Plage | Accepte |
| --- | --- |
| `^5.2.0` | `>=5.2.0 <6.0.0` |
| `~4.1.0` | `>=4.1.0 <4.2.0` |
| `9.6.0` | exactement 9.6.0 |
| `^0.3.1` | `>=0.3.1 <0.4.0` (en 0.x, le mineur est traité comme un majeur) |

- Le **lockfile** (`package-lock.json`, `pnpm-lock.yaml`) fige l'arbre exact, dépendances transitives comprises. **On le commite** (applications comme librairies).
- **`npm ci`** installe exactement le lockfile, supprime `node_modules` avant et échoue si `package.json` et le lockfile divergent : c'est la commande de CI. `npm install` peut, lui, mettre à jour le lockfile.
- `peerDependencies` : « je fonctionne avec la version de X que **vous** installez » (plugins, composants React).
- `overrides` (npm) / `pnpm.overrides` forcent la version d'une dépendance transitive (correctif de sécurité urgent).

## Sécurité de la chaîne d'approvisionnement

En 2025, plusieurs attaques ont visé npm à grande échelle : prise de contrôle de comptes de mainteneurs (paquets `chalk`, `debug`… publiés en version piégée), puis le ver **Shai-Hulud**, qui volait les tokens des développeurs pour se republier dans leurs propres paquets. Les vecteurs : scripts `postinstall` et versions malveillantes installées dans les heures suivant leur publication.

Les parades actuelles :

- **pnpm 10** n'exécute plus les scripts de cycle de vie (`postinstall`) des dépendances par défaut : on autorise explicitement (`pnpm approve-builds`, `onlyBuiltDependencies`).
- **Délai de quarantaine** : `minimumReleaseAge` (pnpm) refuse les versions publiées depuis moins de N minutes — la plupart des versions piégées sont retirées en quelques heures.
- **Publication de confiance** (*trusted publishing*, OIDC) : la CI publie sans token longue durée, avec une **provenance** signée qui lie le paquet au commit et au workflow. npm a retiré les tokens « classiques » fin 2025.
- `npm audit` / `pnpm audit`, **Dependabot** ou **Renovate** pour les mises à jour, lockfile revu en code review.
- Moins de dépendances : beaucoup de micro-paquets historiques sont remplacés par l'API standard (`fetch`, `structuredClone`, `util.parseArgs`, `node:test`, `--env-file`).

## Frameworks HTTP

| Framework | Positionnement |
| --- | --- |
| **Express 5** | le classique, minimaliste, écosystème de middlewares immense |
| **Fastify** | performances, validation et sérialisation par **JSON Schema**, plugins encapsulés |
| **Hono** | basé sur les Web Standards (`Request`/`Response`) : Node, Bun, Deno, Cloudflare Workers |
| **NestJS** | architecture (modules, DI, décorateurs) **au-dessus** d'Express ou de Fastify |
| Next.js, Nuxt, Remix, Astro | frameworks fullstack centrés sur le rendu |

**Express 5** (stable depuis fin 2024) : une promesse rejetée dans un handler `async` est **transmise au middleware d'erreur** (fini les `try/catch` ou `express-async-errors`), syntaxe des routes plus stricte (`/*splat` au lieu de `*`, `{/:id}` pour un segment optionnel), suppression d'API dépréciées.

```ts
import Fastify from 'fastify';
const app = Fastify({ logger: true });   // logger pino intégré

app.post('/users', {
  schema: {
    body: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } },
  },
}, async (req) => ({ id: 1, email: req.body.email }));

await app.listen({ port: 3000 });
```

## Données

| Outil | Approche |
| --- | --- |
| **Prisma** | schéma déclaratif `.prisma` → client typé généré, migrations |
| **Drizzle** | schéma **en TypeScript**, API proche du SQL, très léger |
| **TypeORM** / **MikroORM** | ORM à entités et décorateurs (Data Mapper / Unit of Work) |
| **Kysely** | query builder typé, sans ORM |
| `pg`, `mysql2`, `node:sqlite` | drivers bas niveau |

## Validation, config, logs

- **Zod** (v4), Valibot, ArkType : schémas → types inférés ; **Standard Schema** est l'interface commune que les frameworks acceptent indifféremment.
- **pino** : logger JSON, très rapide (le formatage est délégué à un *transport*). Logs **structurés** en production, jamais `console.log` de chaînes concaténées.
- Configuration : `node --env-file=.env` (natif) ou `process.loadEnvFile()`, puis validation du résultat par un schéma.

## Tests

| Outil | Quand |
| --- | --- |
| **`node:test`** | intégré, zéro dépendance : mocks, timers simulés, couverture, snapshots |
| **Vitest** | API compatible Jest, rapide, natif ESM/TS, mode navigateur |
| **Jest** | historique, encore très présent (NestJS le génère par défaut) |
| **Supertest** | tests HTTP d'une app Express/Fastify/Nest sans ouvrir de port |
| **Testcontainers** | vraie base Postgres/Redis dans Docker pour les tests d'intégration |

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('additionne', () => {
  assert.equal(1 + 1, 2);
});
// node --test   (trouve **/*.test.{js,ts} automatiquement)
```

## Outillage

- **Exécuter du TS** : Node directement (*type stripping*), ou **tsx** (esbuild, supporte enums et `paths`).
- **Rechargement** : `node --watch` remplace nodemon.
- **Lint / format** : ESLint (configuration *flat* `eslint.config.js`) + typescript-eslint + Prettier, ou les alternatives écrites en Rust **Biome** (lint + format) et **Oxlint**.
- **Build** : `tsc` pour une librairie, tsup / tsdown / esbuild pour bundler un service ; Vite (Rolldown depuis Vite 8) côté front.
- **Monorepo** : pnpm workspaces + Turborepo ou Nx.

## Runtimes alternatifs

| | Node.js | Deno 2 | Bun |
| --- | --- | --- | --- |
| Moteur | V8 | V8 | JavaScriptCore |
| Écrit en | C++ | Rust | Zig |
| TypeScript | type stripping | natif (avec vérification) | natif (transpilation) |
| Sécurité | permission model opt-in | **permissions par défaut** (`--allow-net`…) | aucune |
| Outils inclus | test, watch, sqlite | fmt, lint, test, compile | install, test, bundler, sqlite |
| Compat npm | — | oui (`npm:` et `package.json`) | oui, très large |

Node reste le choix par défaut en production (stabilité, LTS, écosystème) ; Bun et Deno ont poussé Node à intégrer TypeScript, un test runner, `--watch` ou SQLite.

## Pour aller plus loin

- [npm Docs — About semantic versioning (EN)](https://docs.npmjs.com/about-semantic-versioning)
- [npm Docs — Trusted publishing (EN)](https://docs.npmjs.com/trusted-publishers)
- [pnpm — Supply chain security (EN)](https://pnpm.io/supply-chain-security)
- [Express — Migrer vers Express 5 (FR)](https://expressjs.com/fr/guide/migrating-5.html)
- [Node.js Best Practices — Structure de projet (FR)](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md#1-structure-de-projet)

<!-- QUIZ -->

### Quelles versions la plage `"^4.17.0"` accepte-t-elle ?
- [ ] Uniquement 4.17.0
- [ ] `>=4.17.0 <4.18.0`
- [x] `>=4.17.0 <5.0.0`
- [ ] Toutes les versions `>=4.17.0`
> Le caret autorise les mises à jour mineures et correctives, pas les majeures (qui peuvent casser l'API). Le tilde `~4.17.0` n'autorise que les correctifs (`<4.18.0`).
[doc]: npm Docs — About semantic versioning (EN) | https://docs.npmjs.com/about-semantic-versioning

### Quel est le piège de `"^0.3.1"` ?
- [ ] Il accepte la 1.0.0
- [x] En version 0.x, le caret n'accepte que `>=0.3.1 <0.4.0` : le mineur est traité comme un majeur
- [ ] Il est invalide
- [ ] Il accepte toutes les 0.x
> Semver considère que tout peut casser avant 1.0. npm traite donc le premier chiffre non nul comme « majeur ». Une bibliothèque en 0.x qui passe de 0.3 à 0.4 ne sera pas installée automatiquement.
[doc]: npm — semver, Caret Ranges (EN) | https://github.com/npm/node-semver#caret-ranges-123-025-004

### Pourquoi utiliser `npm ci` plutôt que `npm install` en CI ?
- [ ] `npm ci` est la seule commande qui installe les devDependencies
- [x] `npm ci` installe exactement le lockfile, part d'un `node_modules` vide et échoue si le lockfile ne correspond pas à `package.json`
- [ ] `npm install` ne fonctionne pas dans Docker
- [ ] `npm ci` met à jour les dépendances vers la dernière version
> La CI doit être reproductible : mêmes versions que sur le poste du développeur, sans modification silencieuse du lockfile. `pnpm install --frozen-lockfile` (défaut en CI) et `yarn install --immutable` sont les équivalents.
[doc]: npm Docs — npm ci (EN) | https://docs.npmjs.com/cli/commands/npm-ci

### Faut-il commiter le lockfile ?
- [ ] Non, il est régénéré à chaque installation
- [x] Oui, pour les applications comme pour les librairies : il garantit des installations reproductibles en développement et en CI
- [ ] Uniquement pour les librairies
- [ ] Uniquement s'il n'y a pas de dépendances transitives
> Sans lockfile, deux installations à une semaine d'écart peuvent récupérer des versions transitives différentes — dont une version piégée. Pour une librairie, le lockfile n'est pas publié sur npm, mais il stabilise sa propre CI.
[doc]: npm Docs — package-lock.json (EN) | https://docs.npmjs.com/cli/configuring-npm/package-lock-json

### Quand déclarer une dépendance en `peerDependencies` ?
- [ ] Pour les dépendances de test
- [x] Quand le paquet est un plugin qui doit utiliser la même instance que l'application hôte (React pour une librairie de composants, `@nestjs/core` pour un module Nest)
- [ ] Pour les dépendances optionnelles
- [ ] Pour accélérer l'installation
> Une librairie de composants qui embarquerait sa propre copie de React provoquerait deux instances et des hooks cassés. Avec `peerDependencies`, c'est l'application qui fournit la version, et le gestionnaire vérifie la compatibilité.
[doc]: npm Docs — peerDependencies (EN) | https://docs.npmjs.com/cli/configuring-npm/package-json#peerdependencies

### Pourquoi `pnpm` est-il dit « strict » ?
- [ ] Il refuse les paquets sans types
- [x] Un paquet ne peut importer que ses dépendances déclarées : pas d'accès aux dépendances « fantômes » hissées par d'autres
- [ ] Il impose semver exact
- [ ] Il n'accepte que l'ESM
> npm et Yarn classique *hissent* toutes les dépendances à la racine de `node_modules` : votre code peut importer un paquet que vous n'avez jamais déclaré, et casser quand la dépendance qui l'apportait change. pnpm utilise des liens symboliques vers un store global et n'expose que ce qui est déclaré.
[doc]: pnpm — Motivation (EN) | https://pnpm.io/motivation

### Quelles mesures réduisent le risque d'installer une version npm piégée ? (plusieurs réponses)
- [x] Ne pas exécuter les scripts `postinstall` des dépendances par défaut (comportement de pnpm 10)
- [x] Refuser les versions publiées depuis moins de quelques heures ou jours (`minimumReleaseAge`)
- [x] Installer depuis un lockfile revu, avec `npm ci`
- [ ] Remplacer toutes les plages `^` par `*`
> Les attaques de 2025 (comptes de mainteneurs compromis, ver Shai-Hulud) exploitaient les scripts d'installation et la mise à jour automatique vers la dernière version. Un délai de quarantaine laisse le temps au registre de retirer les versions malveillantes. `*` accepterait n'importe quelle version, l'inverse de ce qu'on veut.
[doc]: pnpm — Supply chain security (EN) | https://pnpm.io/supply-chain-security

### Qu'apporte la *trusted publishing* (publication de confiance) sur npm ?
- [ ] Un badge « vérifié » attribué manuellement par npm
- [x] La CI publie via OIDC sans token longue durée, et une provenance signée relie le paquet au dépôt et au workflow qui l'a construit
- [ ] Le chiffrement du code publié
- [ ] Un audit de sécurité automatique du code
> Un token npm volé sur le poste d'un mainteneur permettait de publier n'importe quoi. Avec OIDC, seule la CI configurée (GitHub Actions, GitLab CI) peut publier, avec un jeton éphémère. Les consommateurs vérifient la provenance via `npm audit signatures`.
[doc]: npm Docs — Trusted publishing (EN) | https://docs.npmjs.com/trusted-publishers

### En Express 5, que se passe-t-il quand un handler `async` lève une exception ?
```ts
app.get('/users/:id', async (req, res) => {
  const user = await repo.findOrFail(req.params.id);   // lève NotFoundError
  res.json(user);
});
```
- [ ] La requête reste pendante jusqu'au timeout
- [x] La promesse rejetée est transmise au middleware d'erreur, comme un `next(err)`
- [ ] Le processus Node s'arrête
- [ ] Express renvoie 200 avec un corps vide
> En Express 4, un rejet dans un handler async n'était pas capturé : requête pendante et `unhandledRejection`. Il fallait `try/catch` + `next(err)` ou le paquet `express-async-errors`. Express 5 le gère nativement.
[doc]: Express — Migrer vers Express 5 (FR) | https://expressjs.com/fr/guide/migrating-5.html

### Quel est l'atout principal de Fastify par rapport à Express ?
- [ ] Il ne nécessite pas Node.js
- [x] Validation des entrées et sérialisation des réponses compilées à partir de JSON Schema, avec un système de plugins encapsulés
- [ ] Il génère automatiquement le front-end
- [ ] Il n'utilise pas de middleware
> Fastify compile les schémas (Ajv pour la validation, fast-json-stringify pour la sortie) : plus rapide et plus sûr (les champs non déclarés ne fuient pas dans la réponse). NestJS peut utiliser Fastify comme adaptateur HTTP à la place d'Express.
[doc]: Fastify — Validation and Serialization (EN) | https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/

### Pourquoi Hono fonctionne-t-il sur Node, Bun, Deno et Cloudflare Workers ?
- [ ] Il embarque son propre moteur JavaScript
- [x] Il est construit sur les API Web Standards (`Request`, `Response`, `fetch`) communes à ces runtimes
- [ ] Il compile en WebAssembly
- [ ] Il n'utilise que CommonJS
> Les runtimes « edge » n'ont pas les modules `node:http`. Un handler `(req: Request) => Response` est portable partout ; Hono fournit un adaptateur léger pour Node.
[doc]: Hono — Web Standard (EN) | https://hono.dev/docs/concepts/web-standard

### Quelle est la différence d'approche entre Prisma et Drizzle ?
- [ ] Prisma ne supporte que MongoDB
- [x] Prisma part d'un schéma `.prisma` et génère un client ; Drizzle décrit le schéma directement en TypeScript avec une API proche du SQL
- [ ] Drizzle ne gère pas les migrations
- [ ] Prisma n'est pas typé
> Les deux sont typés de bout en bout. Prisma privilégie une API haut niveau et un langage de schéma dédié ; Drizzle reste au plus près du SQL, sans étape de génération, ce qui plaît aux équipes à l'aise avec SQL et aux environnements serverless.
[doc]: Drizzle ORM — Overview (EN) | https://orm.drizzle.team/docs/overview

### Pourquoi préférer pino à `console.log` en production ?
- [ ] `console.log` ne fonctionne pas dans Docker
- [x] pino produit des logs JSON structurés (niveaux, champs, contexte), exploitables par les outils d'agrégation, avec un coût minimal
- [ ] pino chiffre les logs
- [ ] `console.log` est asynchrone
> Un log JSON `{ level, time, requestId, userId, msg }` se filtre et s'agrège dans Loki, Datadog ou Elastic. `console.log` produit du texte libre, sans niveau, et écrit de façon synchrone sur un terminal. pino délègue le formatage lisible à un *transport* hors du thread principal.
[doc]: pino — documentation (EN) | https://getpino.io/

### Quel est l'avantage de `node:test` sur Jest ou Vitest ?
- [ ] Il est plus riche en fonctionnalités
- [x] Il est intégré à Node : aucune dépendance, et il exécute le code tel que Node l'exécute (ESM, type stripping)
- [ ] Il est le seul à supporter TypeScript
- [ ] Il génère des rapports HTML
> `node --test` fournit `describe`/`it`, mocks (`mock.fn`, `mock.timers`), couverture et snapshots. Vitest reste plus confortable (mode watch avancé, UI, intégration Vite) ; Jest reste répandu, notamment dans les projets NestJS générés par la CLI.
[doc]: Node.js — Test runner (EN) | https://nodejs.org/api/test.html

### À quoi sert Testcontainers dans une suite de tests ?
- [ ] À exécuter les tests unitaires plus vite
- [x] À démarrer une vraie base de données (ou Redis, Kafka…) dans Docker pour les tests d'intégration, puis à la détruire
- [ ] À simuler une base de données en mémoire
- [ ] À déployer l'application dans un conteneur
> Tester contre SQLite ou un mock alors que la production utilise PostgreSQL masque des différences (types, contraintes, SQL spécifique). Testcontainers lance l'image réelle, avec un port aléatoire, depuis le code de test.
[doc]: Testcontainers for Node.js (EN) | https://node.testcontainers.org/

### Quel outil remplace nodemon dans Node moderne ?
- [ ] `node --inspect`
- [x] `node --watch` (stable depuis Node 22)
- [ ] `npm run dev`
- [ ] `node --run`
> `--watch` redémarre le processus quand un fichier importé change ; `--watch-path` cible des dossiers précis. `node --run script` est un autre ajout, qui exécute un script de `package.json` plus vite que `npm run`.
[doc]: Node.js — --watch (EN) | https://nodejs.org/api/cli.html#--watch

### Quelle différence majeure Deno a-t-il avec Node en matière de sécurité ?
- [ ] Deno n'exécute pas de code distant
- [x] Deno refuse par défaut l'accès au réseau, au disque et à l'environnement : il faut l'accorder explicitement (`--allow-net`, `--allow-read`…)
- [ ] Deno chiffre la mémoire
- [ ] Il n'y a aucune différence
> Node a un modèle similaire (`--permission`), mais il est **opt-in** : par défaut, tout script a tous les droits. Deno inverse la logique. Deno 2 est par ailleurs compatible avec `package.json` et les paquets npm.
[doc]: Deno — Security and permissions (EN) | https://docs.deno.com/runtime/fundamentals/security/

### Qu'est-ce qui caractérise Bun ?
- [ ] Un fork de Node.js avec V8
- [x] Un runtime basé sur JavaScriptCore et écrit en Zig, qui intègre gestionnaire de paquets, bundler et test runner
- [ ] Un framework web pour Node
- [ ] Un gestionnaire de paquets uniquement
> Bun vise la compatibilité avec les API Node et npm, avec des démarrages et installations très rapides. On l'adopte souvent d'abord comme outil (`bun install`, `bun test`) avant de l'utiliser comme runtime de production.
[doc]: Bun — documentation (EN) | https://bun.sh/docs

### Comment forcer la version d'une dépendance transitive vulnérable sans attendre une mise à jour de la dépendance directe ?
- [ ] Modifier le fichier dans `node_modules`
- [x] Utiliser `overrides` (npm) ou `pnpm.overrides` dans `package.json`
- [ ] Ajouter la dépendance en `devDependencies`
- [ ] Supprimer le lockfile
> `"overrides": { "lodash": "4.17.21" }` impose la version partout dans l'arbre. À utiliser comme rustine temporaire, documentée, à retirer quand la dépendance directe se met à jour.
[doc]: npm Docs — overrides (EN) | https://docs.npmjs.com/cli/configuring-npm/package-json#overrides

### À quoi sert le champ `engines` ?
```json
{ "engines": { "node": ">=22" } }
```
- [ ] À installer automatiquement la bonne version de Node
- [x] À déclarer les versions de Node supportées ; npm avertit (ou échoue avec `engine-strict`) si la version ne correspond pas
- [ ] À choisir le moteur JavaScript
- [ ] À activer le type stripping
> `engines` documente le contrat de compatibilité. Pour fixer la version utilisée en développement, on ajoute `.nvmrc` / `.node-version` (lus par nvm, fnm, Volta, mise) et l'image Docker de production.
[doc]: npm Docs — engines (EN) | https://docs.npmjs.com/cli/configuring-npm/package-json#engines
