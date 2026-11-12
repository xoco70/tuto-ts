---
id: node-nouveautes
track: nodejs
order: 3
title: Nouveautés de Node.js 20 → 26 et cycle de versions
level: Avancé
summary: Cycle LTS et nouveau calendrier annuel, TypeScript natif, require(esm), modèle de permissions, API web intégrées, Temporal — ce qui a changé de Node 20 à Node 26.
---

## Le cycle de versions

### Jusqu'à Node 26

- Deux versions majeures par an : en **avril** (paire) et en **octobre** (impaire).
- Les versions **paires** deviennent **LTS** en octobre et sont maintenues ~30 mois (*Active* puis *Maintenance*).
- Les versions **impaires** ne vivent que 6 mois environ : pour tester, pas pour la production.

### À partir de Node 27 : une version par an

Annoncé en 2026, le nouveau modèle :

| Phase | Durée | Rôle |
| --- | --- | --- |
| **Alpha** | 6 mois (oct. → mars) | test précoce par les auteurs de librairies, changements majeurs autorisés (`27.0.0-alpha.1`) |
| **Current** | 6 mois (avril → oct.) | stabilisation |
| **LTS** | 30 mois | correctifs de sécurité |

- **Toutes** les versions deviennent LTS : fin de la distinction paire / impaire.
- Le numéro suit l'année : **27.0.0 en avril 2027**, 28.0.0 en 2028.
- Node 26 est la dernière version de l'ancien modèle.

### État en novembre 2026

| Version | Nom | Statut | Fin de vie |
| --- | --- | --- | --- |
| 27 | — | **Alpha** (depuis fin octobre 2026) | avril 2030 |
| **26** | Lithium | **Active LTS** (depuis le 28 octobre 2026) | avril 2029 |
| 24 | Krypton | Maintenance LTS | avril 2028 |
| 22 | Jod | Maintenance LTS | avril 2027 |
| 20 | Iron | **fin de vie** (avril 2026) | — |

En production : uniquement une LTS. Une version en fin de vie ne reçoit plus de correctifs de sécurité.

## TypeScript exécuté nativement

```bash
node server.ts        # Node 22.18+ / 23.6+ : aucun flag
```

Node **retire les annotations de type** (*type stripping*) en les remplaçant par des espaces : pas de source maps nécessaires, pas de vérification de types.

| Version | Étape |
| --- | --- |
| 22.6 | `--experimental-strip-types` |
| 22.18 / 23.6 | activé par défaut |
| 24.12 / 25.2 | **stable** |
| 26.0 | suppression de `--experimental-transform-types` |

Contraintes à connaître :

- Uniquement la syntaxe **effaçable** : pas d'`enum`, de `namespace` avec du code, de *parameter properties*, ni de décorateurs → activer `erasableSyntaxOnly` dans le tsconfig.
- Le `tsconfig.json` est **ignoré** : pas de `paths` (utiliser les *subpath imports* `#…`), pas de transpilation vers une cible plus ancienne.
- Imports avec l'extension **`.ts`** (`import { x } from './util.ts'`) et `import type` obligatoire pour les types.
- Refusé dans `node_modules` : une librairie publiée doit toujours livrer du JavaScript.
- `.tsx` non supporté.

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

Le contrôle de types reste le rôle de `tsc --noEmit` en CI. NestJS, qui repose sur les décorateurs et `emitDecoratorMetadata`, a toujours besoin d'une compilation (`tsc` ou swc).

## Modules : `require(esm)`

| Version | Étape |
| --- | --- |
| 22.0 | `--experimental-require-module` |
| 22.12 / 20.19 | activé par défaut |
| 25.4 | stable |

Un fichier CommonJS peut faire `require()` d'un module ESM **synchrone** (sans `await` top-level, sinon `ERR_REQUIRE_ASYNC_MODULE`). Les librairies peuvent publier **uniquement en ESM** sans casser leurs utilisateurs CommonJS : la fin du casse-tête du *dual package*.

Autres ajouts côté modules :

- `import.meta.dirname` / `import.meta.filename` (20.11).
- `process.getBuiltinModule('node:fs')` (22.3) : charger un module natif sans `import` statique.
- `module.enableCompileCache()` (22.1) : cache du bytecode V8 sur disque, démarrages plus rapides (utilisé par `tsc`, ESLint, npm).
- `module.registerHooks()` : hooks de chargement **synchrones**, qui remplacent `module.register()` (déprécié à l'exécution en Node 26).

## Ce qui a remplacé des dépendances

| Avant | Maintenant | Depuis |
| --- | --- | --- |
| `dotenv` | `node --env-file=.env`, `process.loadEnvFile()` | 20.6 / 21.7 |
| `nodemon` | `node --watch` | stable en 22 |
| `node-fetch`, `axios` (cas simples) | `fetch` global (undici) | stable en 21 |
| `ws` (client) | `WebSocket` global | 22 |
| `glob` | `fs.glob()` | 22 |
| `chalk` | `util.styleText()` | 22 |
| `yargs` (cas simples) | `util.parseArgs()` | 18.3 |
| `jest` / `mocha` | `node:test` (mocks, timers, couverture, snapshots) | stable en 20 |
| `better-sqlite3` | `node:sqlite` (release candidate en 25.7) | 22.5 |
| `npm run` | `node --run` (plus rapide) | 22 |
| `url-pattern`, `path-to-regexp` | `URLPattern` global | 24 |
| `dayjs`, `luxon`, `date-fns` | **`Temporal`** global | 26 |

```ts
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('app.db');
db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT) STRICT');
db.prepare('INSERT INTO users (email) VALUES (?)').run('ada@example.com');
```

## Le modèle de permissions

```bash
node --permission --allow-fs-read=./config --allow-fs-write=./tmp app.js
```

- `--experimental-permission` (20) devient **`--permission`** (22.13 / 23.5, confirmé en 24).
- Sans autorisation explicite, l'accès au disque, aux processus enfants, aux workers, aux addons natifs est refusé (`ERR_ACCESS_DENIED`).
- Node 25 ajoute **`--allow-net`** (réseau) et `--allow-inspector`.
- Vérification à l'exécution : `process.permission.has('fs.write', './tmp')`.

C'est une **ceinture de sécurité** (limiter les dégâts d'une dépendance compromise), pas un bac à sable : du code malveillant qui tourne déjà dans le processus a d'autres moyens d'agir.

## Le moteur V8 et le langage

| Node | V8 | Nouveautés JavaScript |
| --- | --- | --- |
| 20 | 11.3 | `toSorted` / `toReversed` / `toSpliced` / `with` (copies de tableaux non mutantes) |
| 22 | 12.4 | méthodes de `Set` (`union`, `intersection`…), helpers d'itérateurs (`.map().filter().take()`), `Promise.withResolvers` |
| 24 | 13.6 | **`using`** / `await using`, `RegExp.escape`, `Float16Array`, `Error.isError` |
| 25 | 14.1 | `Uint8Array.fromBase64` / `toBase64` / `toHex`, `JSON.stringify` plus rapide |
| 26 | 14.6 | **`Temporal`** activé par défaut, `Map.prototype.getOrInsert` / `getOrInsertComputed`, `Iterator.concat` |

```ts
// Temporal : des dates sans les pièges de Date
const rdv = Temporal.ZonedDateTime.from('2026-11-12T14:00[Europe/Paris]');
const rappel = rdv.subtract({ hours: 24 });
Temporal.Now.plainDateISO().until(rdv.toPlainDate()).days;

// getOrInsertComputed : fini le "if (!map.has(k)) map.set(k, [])"
const parAuteur = new Map<string, Post[]>();
parAuteur.getOrInsertComputed(post.author, () => []).push(post);
```

## Autres évolutions notables

- **Node 24** : npm 11 ; `AsyncLocalStorage` repose sur `AsyncContextFrame` (plus rapide) ; le test runner attend automatiquement les sous-tests ; `url.parse()` déprécié à l'exécution (utiliser `new URL()`).
- **Node 25** : **Web Storage** (`localStorage`, `sessionStorage`) activé par défaut, adossé à un fichier (`--localstorage-file`) ; `ErrorEvent` global ; `SlowBuffer` supprimé ; **Corepack n'est plus distribué**.
- **Node 26** : undici 8 derrière `fetch` ; suppression de `http.Server.prototype.writeHeader()` (→ `writeHead()`) et des anciens modules internes `_stream_*` ; `assert` accepte des messages au format `printf`.
- **Single Executable Applications** : empaqueter une application et le binaire Node en **un seul exécutable**.

## Monter de version sereinement

1. Lire la section *Notable changes* et les **dépréciations** de chaque version majeure traversée.
2. Lancer les tests avec `--throw-deprecation` (ou au moins surveiller les `DeprecationWarning`).
3. Reconstruire les addons natifs (`NODE_MODULE_VERSION` change à chaque majeure).
4. Mettre à jour en même temps `.nvmrc`, `engines`, l'image Docker et la CI.
5. Viser la **dernière LTS** ; ne pas attendre la fin de vie de la précédente pour migrer.

## Pour aller plus loin

- [Node.js — Releases et calendrier (EN)](https://nodejs.org/en/about/previous-releases)
- [Evolving the Node.js Release Schedule (EN)](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
- [Node.js — Modules: TypeScript (EN)](https://nodejs.org/api/typescript.html)
- [Node.js 26.0.0 — notes de version (EN)](https://nodejs.org/en/blog/release/v26.0.0)
- [MDN — Temporal (FR)](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Temporal)

<!-- QUIZ -->

### En novembre 2026, quelle version de Node.js choisir pour démarrer un nouveau projet en production ?
- [ ] Node 27, la plus récente
- [x] Node 26, la LTS active
- [ ] Node 22, la plus éprouvée
- [ ] Node 20, la plus compatible
> Node 27 est en phase **alpha** (non destinée à la production). Node 26 est passé en Active LTS le 28 octobre 2026 et sera maintenu jusqu'en avril 2029. Node 22 n'est plus qu'en maintenance (fin de vie en avril 2027) et Node 20 est en fin de vie depuis avril 2026.
[doc]: Node.js — Previous releases (EN) | https://nodejs.org/en/about/previous-releases

### Qu'est-ce qui change dans le cycle de versions à partir de Node 27 ?
- [ ] Les versions sortent tous les mois
- [x] Une seule version majeure par an, qui devient toujours LTS, précédée d'une phase alpha ; le numéro suit l'année (27.0.0 en 2027)
- [ ] Il n'y a plus de LTS
- [ ] Seules les versions impaires deviennent LTS
> Fin de l'alternance paire (LTS) / impaire (courte durée). Le cycle est : alpha d'octobre à mars, Current d'avril à octobre, puis 30 mois de LTS, soit 36 mois de support au total.
[doc]: Evolving the Node.js Release Schedule (EN) | https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule

### Sous l'ancien modèle (jusqu'à Node 26), que deviennent les versions impaires comme Node 25 ?
- [ ] Elles deviennent LTS en octobre
- [x] Elles restent *Current* environ 6 mois, puis atteignent leur fin de vie sans passer en LTS
- [ ] Elles sont maintenues 3 ans
- [ ] Elles ne sont jamais publiées
> Les versions impaires servaient à livrer tôt les nouveautés. Node 25, sorti en octobre 2025, a atteint sa fin de vie au printemps 2026. Ce rôle est désormais tenu par le canal **alpha**.
[doc]: Node.js — Release schedule (EN) | https://github.com/nodejs/Release#release-schedule

### Que fait Node 22.18+ quand on lance `node server.ts` ?
- [ ] Il compile le projet avec `tsc` et vérifie les types
- [x] Il retire les annotations de type et exécute le JavaScript restant, sans aucune vérification de types
- [ ] Il refuse : il faut `ts-node`
- [ ] Il transpile vers ES5
> Le *type stripping* remplace les types par des espaces (les numéros de ligne restent identiques, pas besoin de source maps). Une erreur de type ne bloque pas l'exécution : `tsc --noEmit` reste indispensable en CI.
[doc]: Node.js — Modules: TypeScript (EN) | https://nodejs.org/api/typescript.html

### Pourquoi ce fichier échoue-t-il avec le type stripping natif de Node ?
```ts
export enum Role { Admin = 'admin', User = 'user' }
```
- [ ] Les exports nommés ne sont pas supportés
- [x] Un `enum` génère du JavaScript (un objet) : ce n'est pas de la syntaxe simplement effaçable
- [ ] Les enums de chaînes n'existent pas en TypeScript
- [ ] Il manque `import type`
> Node ne fait qu'effacer : `enum`, `namespace` contenant du code, *parameter properties* et décorateurs sont refusés (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). L'option `erasableSyntaxOnly` de TS 5.8 les signale dès l'éditeur. Alternative : `const Role = { Admin: 'admin', User: 'user' } as const`.
[doc]: Node.js — TypeScript, type stripping (EN) | https://nodejs.org/api/typescript.html#type-stripping

### Avec le type stripping, pourquoi `paths` du tsconfig ne fonctionne-t-il pas ?
- [ ] `paths` est déprécié
- [x] Node ignore complètement `tsconfig.json` ; il faut utiliser les *subpath imports* (`"imports": { "#lib/*": … }`) de `package.json`
- [ ] Il faut ajouter `--tsconfig`
- [ ] `paths` ne fonctionne qu'avec CommonJS
> Le type stripping est volontairement minimal : pas de lecture du tsconfig, pas de réécriture d'imports. Les *subpath imports* sont résolus nativement par Node et compris par TypeScript.
[doc]: Node.js — TypeScript, paths aliases (EN) | https://nodejs.org/api/typescript.html#paths-aliases

### Avec le type stripping de Node, comment importer `util.ts` depuis `index.ts` ?
- [ ] `import { x } from './util'`
- [ ] `import { x } from './util.js'`
- [x] `import { x } from './util.ts'`
- [ ] `import { x } from 'util'`
> Node exécute les fichiers sources tels quels : l'import doit pointer vers le vrai fichier `.ts`. Côté `tsc`, `allowImportingTsExtensions` ou `rewriteRelativeImportExtensions` (qui réécrit en `.js` à la compilation) rend ces imports valides.
[doc]: Node.js — TypeScript, importing types without type keyword (EN) | https://nodejs.org/api/typescript.html#importing-types-without-type-keyword

### Une librairie veut publier uniquement en ESM. Pourquoi est-ce devenu raisonnable avec Node 22.12+ et 20.19+ ?
- [ ] CommonJS a été supprimé de Node
- [x] Les projets CommonJS peuvent désormais faire `require()` d'un module ESM synchrone
- [ ] npm convertit automatiquement les paquets
- [ ] Les bundlers ne supportent plus CommonJS
> Avant `require(esm)`, une librairie ESM-only obligeait les utilisateurs CommonJS à passer par `await import()`. Il fallait donc publier deux builds (*dual package*), avec le risque de deux instances du même module. Seule limite : pas d'`await` au top-level dans le graphe chargé.
[doc]: Node.js — Loading ECMAScript modules using require() (EN) | https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require

### Quelle commande remplace le paquet `dotenv` ?
- [ ] `node --env .env app.js`
- [x] `node --env-file=.env app.js`
- [ ] `node --dotenv app.js`
- [ ] `npm run env`
> `--env-file` (20.6) charge le fichier avant l'exécution ; `--env-file-if-exists` ne plante pas si le fichier manque, et `process.loadEnvFile()` le fait depuis le code. Il faut toujours **valider** les valeurs obtenues (Zod, `ConfigModule`).
[doc]: Node.js — --env-file (EN) | https://nodejs.org/api/cli.html#--env-filefile

### Que fait ce lancement ?
```bash
node --permission --allow-fs-read=./config app.js
```
- [ ] Il exécute l'application avec les droits root
- [x] Il active le modèle de permissions : seule la lecture de `./config` est autorisée ; écriture disque, processus enfants, workers et addons natifs sont refusés
- [ ] Il chiffre le dossier `./config`
- [ ] Il n'a aucun effet sans Docker
> Le modèle de permissions (`--experimental-permission` en 20, `--permission` depuis 22.13 / 23.5) restreint ce que le processus peut faire. Node 25 ajoute `--allow-net` pour le réseau. Ce n'est pas un bac à sable complet, mais cela limite l'impact d'une dépendance compromise.
[doc]: Node.js — Permissions (EN) | https://nodejs.org/api/permissions.html

### Quelles API sont disponibles **globalement**, sans import, dans Node 26 ? (plusieurs réponses)
- [x] `fetch`
- [x] `URLPattern`
- [x] `Temporal`
- [ ] `express`
> `fetch` (undici) est stable depuis Node 21, `URLPattern` global depuis Node 24, `Temporal` activé par défaut depuis Node 26 (V8 14.6). Node converge vers les API web : le même code tourne côté navigateur, Deno, Bun et workers edge.
[doc]: Node.js 26.0.0 — notes de version (EN) | https://nodejs.org/en/blog/release/v26.0.0

### Quel problème de `Date` l'API `Temporal` résout-elle ?
- [ ] `Date` ne fonctionne pas dans Node
- [x] `Date` est mutable, ne gère qu'UTC et le fuseau local, et mélange instant et date calendaire ; `Temporal` fournit des types immuables distincts avec fuseaux horaires explicites
- [ ] `Date` ne gère pas les millisecondes
- [ ] `Temporal` est plus rapide que `Date`
> `Temporal.Instant` (un instant), `PlainDate` (une date sans heure), `ZonedDateTime` (date + heure + fuseau IANA), `Duration`… Chaque opération retourne un nouvel objet. Fini les bugs de mois indexés à 0 et de calculs faussés par le changement d'heure.
[doc]: MDN — Temporal (FR) | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Temporal

### Que fait `map.getOrInsertComputed(cle, () => [])` (Node 26, V8 14.6) ?
- [ ] Il remplace toujours la valeur par `[]`
- [x] Il retourne la valeur existante pour `cle`, ou appelle la fonction, insère son résultat et le retourne si la clé est absente
- [ ] Il lève une erreur si la clé existe
- [ ] Il retourne une promesse
> C'est la proposition *upsert* : elle remplace le motif `if (!map.has(k)) map.set(k, []); map.get(k)!.push(x)`. `getOrInsert(cle, valeur)` prend une valeur directe ; la version `Computed` ne calcule la valeur que si nécessaire.
[doc]: MDN — Map.prototype.getOrInsertComputed (EN) | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsertComputed

### Quelle nouveauté du langage arrive avec V8 13.6 dans Node 24 ?
- [ ] Les décorateurs
- [x] La gestion explicite des ressources (`using`, `await using`, `Symbol.dispose`)
- [ ] Les types à l'exécution
- [ ] Les enums
> Node 24 exécute nativement `using` (que TypeScript compilait déjà depuis 5.2). Les décorateurs, eux, ne sont toujours pas implémentés par V8. Node 24 apporte aussi `RegExp.escape`, `Float16Array` et `Error.isError`.
[doc]: Node.js 24.0.0 — notes de version (EN) | https://nodejs.org/en/blog/release/v24.0.0

### Après une montée en Node 25, la CI échoue sur `corepack enable`. Pourquoi ?
- [ ] Corepack a été renommé `npx`
- [x] Corepack n'est plus distribué avec Node depuis la v25 : il faut l'installer séparément ou installer pnpm/Yarn directement
- [ ] pnpm n'est plus compatible avec Node 25
- [ ] Le champ `packageManager` est interdit
> Le TSC Node a décidé de ne plus embarquer Corepack. Solutions : `npm install -g corepack`, l'action `pnpm/action-setup` en CI, ou un gestionnaire de versions (mise, Volta). Le champ `packageManager` reste utile pour documenter la version attendue.
[doc]: Node.js 25.0.0 — notes de version (EN) | https://nodejs.org/en/blog/release/v25.0.0

### Que permet le module `node:sqlite` ?
- [ ] Se connecter à un serveur PostgreSQL
- [x] Utiliser une base SQLite embarquée sans dépendance native à compiler
- [ ] Remplacer Prisma
- [ ] Stocker les sessions HTTP automatiquement
> Ajouté en 22.5, sans flag depuis 22.13 / 23.4, il est en *release candidate* depuis 25.7. Idéal pour les CLI, les tests, les petites applications ou un cache local. Pour un serveur de production multi-instances, on garde un SGBD client-serveur.
[doc]: Node.js — SQLite (EN) | https://nodejs.org/api/sqlite.html

### Quelles bonnes pratiques appliquer lors d'une montée de version majeure de Node ? (plusieurs réponses)
- [x] Lire les dépréciations et changements majeurs de chaque version traversée
- [x] Reconstruire les addons natifs (`NODE_MODULE_VERSION` change)
- [x] Mettre à jour ensemble `.nvmrc`, `engines`, l'image Docker et la CI
- [ ] Attendre la fin de vie de l'ancienne version pour commencer
> Chaque majeure change l'ABI des modules natifs (`bcrypt`, `sharp`…). Une version incohérente entre poste, CI et production fait réapparaître des bugs « impossibles à reproduire ». Migrer avant la fin de vie laisse le temps de traiter les surprises.
[doc]: Node.js — Deprecated APIs (EN) | https://nodejs.org/api/deprecations.html

### Pourquoi `import.meta.dirname` (Node 20.11) est-il bienvenu ?
- [ ] Il donne le dossier de lancement du processus
- [x] Il fournit en ESM l'équivalent de `__dirname`, sans passer par `fileURLToPath(new URL('.', import.meta.url))`
- [ ] Il remplace `process.cwd()`
- [ ] Il n'existe qu'en CommonJS
> L'incantation `path.dirname(fileURLToPath(import.meta.url))` était un frein classique à l'adoption d'ESM. `import.meta.dirname` et `import.meta.filename` la rendent inutile.
[doc]: Node.js — import.meta.dirname (EN) | https://nodejs.org/api/esm.html#importmetadirname

### Pourquoi un fichier `.ts` présent dans `node_modules` n'est-il pas exécuté par Node ?
- [ ] C'est un bug corrigé en Node 26
- [x] Node refuse volontairement le type stripping dans `node_modules` : les paquets publiés doivent fournir du JavaScript
- [ ] npm supprime les fichiers `.ts` à l'installation
- [ ] Il faut activer `allowJs`
> Le choix évite que l'écosystème publie du TypeScript brut dépendant d'une version précise de l'outil de stripping, et préserve les performances de chargement. Une librairie compile donc toujours vers `.js` + `.d.ts`.
[doc]: Node.js — TypeScript, type stripping in dependencies (EN) | https://nodejs.org/api/typescript.html#type-stripping-in-dependencies
