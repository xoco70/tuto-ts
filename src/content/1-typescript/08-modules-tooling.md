---
id: ts-modules-tooling
track: typescript
order: 8
title: Modules, tsconfig, validation runtime et outillage
level: Avancé
summary: ESM vs CommonJS, fichiers de déclaration, options tsconfig qui comptent, validation runtime avec Zod, monorepo et outillage.
---

## ESM vs CommonJS

```ts
// CommonJS (historique Node)
const fs = require('fs');
module.exports = { lire };

// ES Modules (standard)
import { readFile } from 'node:fs/promises';
export function lire() {}
export default class App {}
```

| | CommonJS | ESM |
| --- | --- | --- |
| Chargement | synchrone, dynamique | asynchrone, **statique** (analysable → tree-shaking) |
| `__dirname` | ✅ | ❌ → `import.meta.dirname` (Node 20.11+) |
| `await` au top-level | ❌ | ✅ |
| Activation dans Node | défaut | `"type": "module"` ou extension `.mjs` |

En ESM natif sous Node, les imports relatifs doivent avoir l'**extension** : `import { x } from './util.js'` (même depuis un fichier `.ts` compilé par `tsc`, avec `module: nodenext`).

### `import type`

```ts
import type { User } from './user';          // effacé à la compilation
import { type User, creerUser } from './user';
```

Avec `verbatimModuleSyntax`, TS conserve tel quel tout import non marqué `type` : on évite les effets de bord et les imports fantômes.

## Fichiers de déclaration `.d.ts`

- Décrivent des types **sans implémentation** (`declare function`, `declare module`).
- Les paquets publiés les fournissent (`"types"` dans `package.json`) ou via `@types/xxx` (DefinitelyTyped).
- `declare module '*.svg' { const src: string; export default src; }` pour typer des imports non-JS.
- `skipLibCheck: true` ne vérifie pas les `.d.ts` des dépendances (plus rapide, usage courant).

## Options tsconfig qui comptent

| Option | Pourquoi |
| --- | --- |
| `strict` | le minimum non négociable |
| `noUncheckedIndexedAccess` | `arr[i]` et `record[k]` deviennent `T \| undefined` |
| `exactOptionalPropertyTypes` | `a?: string` n'accepte plus `undefined` explicite |
| `module` / `moduleResolution` | `nodenext` pour Node, `bundler` pour Vite/webpack |
| `target` / `lib` | syntaxe émise et API disponibles |
| `isolatedModules` | chaque fichier compilable seul (esbuild, swc, Babel) |
| `paths` + `baseUrl` | alias d'import (`@app/*`) — à configurer aussi dans le bundler/runtime |
| `composite` + `references` | *project references* pour monorepos et builds incrémentaux |

`tsc` ne fait **que** vérifier les types dans la plupart des projets modernes : la transpilation est déléguée à **esbuild**, **swc** (NestJS CLI peut l'utiliser), Vite, ou au *type stripping* de Node. Ces outils **n'effectuent aucun contrôle de types** : il faut lancer `tsc --noEmit` en CI.

## Validation à l'exécution : Zod

Les types ne protègent pas des données externes (body HTTP, variables d'env, réponse d'API). Il faut **valider au runtime**, à la frontière.

```ts
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
  role: z.enum(['admin', 'user']).default('user'),
});
type User = z.infer<typeof UserSchema>;   // type dérivé du schéma : une seule source de vérité

const result = UserSchema.safeParse(json);
if (!result.success) {
  console.log(result.error.issues);
} else {
  result.data.email;   // typé
}
```

- `parse` lève une `ZodError`, `safeParse` renvoie un résultat discriminé.
- En NestJS, l'équivalent historique est `class-validator` + `ValidationPipe` ; Zod est aussi utilisable via un pipe.
- Partager les schémas Zod entre front et back (monorepo) = validation identique des deux côtés.

## Monorepo fullstack

```
apps/
  api/        (NestJS)
  web/        (React / Next.js)
packages/
  shared/     (types, schémas Zod, DTO partagés)
  ui/
```

Outils : **pnpm workspaces**, **Turborepo** ou **Nx** (cache de build, graphe de dépendances, `affected`). Le gain principal : un changement de contrat d'API casse la compilation du front immédiatement.

## Qualité

- **ESLint** + `typescript-eslint` (règles typées : `no-floating-promises`, `no-misused-promises`, `strict-boolean-expressions`).
- **Prettier** pour le formatage.
- `tsc --noEmit` en CI.

<!-- QUIZ -->

### Que contient un fichier `.d.ts` ?
- [ ] Du code TypeScript compilé en JavaScript
- [x] Uniquement des déclarations de types, sans implémentation
- [ ] Les tests d'un module
- [ ] La configuration du compilateur
> Un fichier de déclaration décrit la **forme** d'un code (fonctions, classes, modules) sans le code lui-même. Il sert à typer une librairie JavaScript ou les fichiers émis par `tsc` ; il ne produit aucun JavaScript.
[doc]: Handbook — Consommer des déclarations (EN) | https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html
[niveau]: facile

### Que signifie cette ligne dans un `.d.ts` ?
```ts
declare function formatDate(d: Date): string;
```
- [ ] Elle définit une fonction vide
- [x] Elle annonce à TS qu'une fonction `formatDate` existe ailleurs (dans du JS) et décrit sa signature
- [ ] Elle rend la fonction globale à l'exécution
- [ ] Elle importe `formatDate` depuis `node_modules`
> `declare` décrit quelque chose qui existe **déjà** à l'exécution, sans rien générer. TS peut alors vérifier les appels (`formatDate(new Date())` renvoie un `string`), mais c'est à toi de garantir que la fonction existe bien.
[doc]: Handbook — Consommer des déclarations (EN) | https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html
[niveau]: facile

### Comment importer en une seule ligne le type `User` et la fonction `creerUser` d'un module, en marquant le type ?
- [ ] `import { User, creerUser } from './user'` (TS devine)
- [x] `import { type User, creerUser } from './user'`
- [ ] `import type { User, creerUser } from './user'`
- [ ] `import { User as type, creerUser } from './user'`
> Le modificateur `type` peut s'appliquer à un seul nom dans l'import : `User` sera effacé, `creerUser` sera conservé. `import type { … }` marquerait tout l'import comme type, et `creerUser` ne serait plus utilisable comme valeur.
[doc]: Handbook — Modules (import type) | https://www.typescriptlang.org/fr/docs/handbook/2/modules.html
[niveau]: facile

### Quelle commande vérifie les types d'un projet sans générer de fichiers JavaScript ?
- [ ] `tsc --watch`
- [x] `tsc --noEmit`
- [ ] `tsc --init`
- [ ] `tsc --build --clean`
> `--noEmit` fait tout le travail de vérification mais n'écrit rien sur le disque. C'est la commande à lancer en CI quand la transpilation est faite par un autre outil (Vite, esbuild, swc).
[doc]: Référence tsconfig — noEmit | https://www.typescriptlang.org/fr/tsconfig#noEmit
[niveau]: facile

### À quoi sert l'option `target` du `tsconfig.json` ?
- [ ] À choisir le dossier de sortie
- [x] À choisir la version d'ECMAScript de la syntaxe émise (ex. `es2022`)
- [ ] À désigner le fichier d'entrée du projet
- [ ] À choisir entre Node et le navigateur
> `target` fixe la syntaxe du JS produit : avec une cible ancienne, `tsc` réécrit par exemple les classes ou `async/await`. Les API disponibles (`Array.prototype.at`, DOM…) sont réglées à part, par `lib`.
[doc]: Référence tsconfig — target | https://www.typescriptlang.org/fr/tsconfig#target
[niveau]: facile

### Comment indiquer à Node que les fichiers `.js` d'un paquet sont des modules ES ?
- [ ] Ajouter `"use module";` en haut de chaque fichier
- [x] Mettre `"type": "module"` dans le `package.json`
- [ ] Activer `esModuleInterop` dans le `tsconfig.json`
- [ ] C'est automatique dès qu'un fichier contient `import`
> Sans indication, Node traite les `.js` comme du CommonJS. `"type": "module"` bascule tout le paquet en ESM ; on peut aussi forcer un fichier avec l'extension `.mjs` (ESM) ou `.cjs` (CommonJS).
[doc]: Node.js — Package entry points (EN) | https://nodejs.org/api/packages.html#package-entry-points
[niveau]: facile

### Lesquelles de ces lignes sont de la syntaxe CommonJS ? (plusieurs réponses)
- [x] `const fs = require('fs');`
- [x] `module.exports = { lire };`
- [ ] `import { readFile } from 'node:fs/promises';`
- [ ] `export default class App {}`
> CommonJS, le système historique de Node, repose sur `require` et `module.exports`. `import` et `export` sont la syntaxe des **ES Modules**, le standard du langage, analysable statiquement.
[doc]: MDN — Modules JavaScript | https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Modules
[niveau]: facile

### Que renvoie `UserSchema.parse(json)` quand les données sont valides ?
```ts
const UserSchema = z.object({ email: z.string(), age: z.number() });
const user = UserSchema.parse(json);
```
- [ ] `true`
- [x] Les données validées, typées `{ email: string; age: number }`
- [ ] Un objet `{ success: true }`
- [ ] Une Promise
> `parse` renvoie les données validées, avec un type dérivé du schéma : `json` était `unknown`, `user` est maintenant précisément typé. Si les données sont invalides, `parse` lève une `ZodError`.
[doc]: Zod — Parsing data (EN) | https://zod.dev/basics#parsing-data
[niveau]: facile

### En ESM, par quoi remplacer `__dirname` (Node 20.11+) ?
- [ ] `process.cwd()`
- [x] `import.meta.dirname`
- [ ] `module.dirname`
- [ ] `require.main.path`
> `__dirname` n'existe qu'en CommonJS. En ESM, les informations sur le module courant sont dans `import.meta` : `import.meta.dirname` et `import.meta.filename`. `process.cwd()` est le dossier de lancement, pas celui du fichier.
[doc]: Node.js — import.meta.dirname (EN) | https://nodejs.org/api/esm.html#importmetadirname
[niveau]: facile

### Comment se répartissent les rôles entre ESLint (avec `typescript-eslint`) et Prettier ?
- [ ] ESLint formate le code, Prettier détecte les bugs
- [x] ESLint détecte les erreurs et mauvaises pratiques, Prettier ne s'occupe que du formatage
- [ ] Les deux font la même chose, il faut en choisir un
- [ ] Prettier vérifie les types, ESLint le style
> Prettier réécrit la mise en forme (indentation, guillemets, retours à la ligne) sans juger le code. ESLint analyse ce que fait le code : avec les règles typées de `typescript-eslint`, il repère par exemple une Promise oubliée (`no-floating-promises`).
[doc]: typescript-eslint — no-floating-promises (EN) | https://typescript-eslint.io/rules/no-floating-promises/
[niveau]: facile

### Quel est l'avantage principal des imports ESM statiques par rapport à `require` ?
- [ ] Ils sont plus rapides à l'exécution
- [x] Ils sont analysables statiquement, ce qui permet le tree-shaking et la détection d'erreurs à la compilation
- [ ] Ils fonctionnent sans Node.js
- [ ] Ils permettent `__dirname`
> `import`/`export` sont déclarés au niveau supérieur et ne dépendent pas de l'exécution : les bundlers peuvent supprimer le code non utilisé. `require` peut être appelé n'importe où avec n'importe quelle expression.
[doc]: MDN — Modules JavaScript | https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Modules
[niveau]: facile

### Que fait `import type { User } from './user'` ?
- [ ] Il importe la classe `User` au runtime
- [x] Il importe uniquement le type : l'import est entièrement supprimé du JS généré
- [ ] Il convertit `User` en interface
- [ ] Il est réservé aux fichiers `.d.ts`
> `import type` garantit l'effacement, évitant d'exécuter un module pour rien (et des dépendances circulaires au runtime). Attention : en NestJS, un type importé avec `import type` dans un constructeur casse l'injection, car la métadonnée nécessite la valeur de la classe.
[doc]: Handbook — Modules (import type) | https://www.typescriptlang.org/fr/docs/handbook/2/modules.html
[niveau]: facile

### Avec `noUncheckedIndexedAccess`, quel est le type de `x` ?
```ts
const scores: Record<string, number> = {};
const x = scores['alice'];
```
- [ ] `number`
- [x] `number | undefined`
- [ ] `unknown`
- [ ] `any`
> Sans cette option, TS suppose que toute clé existe — ce qui est faux. Avec, chaque accès indexé (tableaux compris) inclut `undefined`, ce qui force à gérer l'absence. Fortement recommandée.
[doc]: Référence tsconfig — noUncheckedIndexedAccess | https://www.typescriptlang.org/fr/tsconfig#noUncheckedIndexedAccess

### Un projet compile avec esbuild ou swc. Quel est le risque ?
- [ ] Aucun : ils vérifient les types plus vite que `tsc`
- [x] Ils retirent les types sans les vérifier : une erreur de type passe inaperçue si on ne lance pas `tsc --noEmit`
- [ ] Ils ne supportent pas les génériques
- [ ] Ils produisent du code plus lent
> esbuild, swc, Babel, Vite et le *type stripping* de Node traitent chaque fichier isolément et effacent les types. Le contrôle de types reste le travail de `tsc` (en CI et dans l'éditeur).
[doc]: Référence tsconfig — isolatedModules | https://www.typescriptlang.org/fr/tsconfig#isolatedModules

### Pourquoi valider un body HTTP avec Zod alors que le paramètre est déjà typé `CreateUserDto` ?
- [ ] Zod est plus rapide que TypeScript
- [x] Le type n'existe pas au runtime : rien n'empêche un client d'envoyer n'importe quelle forme de données
- [ ] TypeScript ne supporte pas les objets imbriqués
- [ ] Ce n'est pas nécessaire
> Les annotations décrivent ce qu'on **suppose**, pas ce qu'on **reçoit**. Toute donnée externe (HTTP, env, fichiers, API tierce, localStorage) doit être validée à la frontière. `z.infer` dérive ensuite le type du schéma.
[doc]: Zod — Introduction (EN) | https://zod.dev/
[niveau]: facile

### Que vaut `User` ?
```ts
const UserSchema = z.object({ email: z.string(), age: z.number().optional() });
type User = z.infer<typeof UserSchema>;
```
- [ ] `ZodObject<...>`
- [x] `{ email: string; age?: number | undefined }`
- [ ] `unknown`
- [ ] `any`
> `z.infer` extrait le type TypeScript correspondant au schéma : on ne maintient qu'une seule source de vérité (schéma → type), au lieu d'une interface et d'un validateur qui divergent.
[doc]: Zod — Type inference (EN) | https://zod.dev/basics#inferring-types

### Quelle est la différence entre `schema.parse(x)` et `schema.safeParse(x)` ?
- [ ] `safeParse` ne valide que les types primitifs
- [x] `parse` lève une `ZodError` si invalide ; `safeParse` retourne `{ success: true, data } | { success: false, error }`
- [ ] `parse` est asynchrone
- [ ] Aucune
> `safeParse` retourne une **union discriminée** sur `success` : idéal pour gérer l'erreur sans `try/catch`.
[doc]: Zod — Parsing data (EN) | https://zod.dev/basics#parsing-data
[niveau]: facile

### Dans un projet Node en ESM natif (`"type": "module"`, `module: nodenext`), comment écrire un import relatif depuis `index.ts` ?
- [ ] `import { x } from './util'`
- [ ] `import { x } from './util.ts'`
- [x] `import { x } from './util.js'`
- [ ] `const { x } = require('./util')`
> La résolution ESM de Node exige l'extension complète, et TS ne réécrit pas les chemins : on écrit l'extension du fichier **émis** (`.js`). Avec `allowImportingTsExtensions`/`rewriteRelativeImportExtensions` (TS 5.7) ou un bundler, `.ts` devient possible.
[doc]: Handbook — Modules : choisir les options (EN) | https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html
[niveau]: avancé

### Comment typer `import logo from './logo.svg'` dans un projet qui n'a pas ce type ?
- [ ] Impossible, il faut convertir le SVG en TSX
- [x] Ajouter une déclaration : `declare module '*.svg' { const src: string; export default src; }`
- [ ] Mettre `// @ts-ignore` au-dessus de chaque import
- [ ] Activer `allowJs`
> Une déclaration de module avec joker (*wildcard module declaration*) dans un `.d.ts` type tous les imports correspondants. Vite fournit ces déclarations via `vite/client`.
[doc]: Modules — Wildcard module declarations (EN) | https://www.typescriptlang.org/docs/handbook/modules/reference.html#ambient-modules

### Dans un monorepo `apps/api` + `apps/web` + `packages/shared`, que met-on idéalement dans `shared` ?
- [ ] Les composants React et les services NestJS
- [x] Les contrats : types / schémas Zod des DTO, constantes, éventuellement un client d'API typé
- [ ] Les variables d'environnement
- [ ] Le code de base de données
> Partager les contrats fait échouer la compilation du front dès qu'une API change. On évite d'y mettre du code dépendant d'un runtime (Node ou DOM) pour qu'il reste utilisable des deux côtés.
[doc]: Turborepo — Structuring a repository (EN) | https://turborepo.com/docs/crafting-your-repository/structuring-a-repository

### Que permet `paths` dans `tsconfig.json` et quel est le piège ?
```json
{ "compilerOptions": { "paths": { "@app/*": ["src/*"] } } }
```
- [ ] Il réécrit les imports dans le JS généré
- [x] Il permet à TS de résoudre `@app/...`, mais ne réécrit pas les imports : le bundler / runtime doit être configuré aussi
- [ ] Il est réservé aux monorepos
- [ ] Il remplace `node_modules`
> `tsc` ne transforme pas les chemins d'import. Il faut un équivalent côté exécution : alias Vite, `moduleNameMapper` Jest, `tsconfig-paths`, ou les *subpath imports* `#app/*` de `package.json`.
[doc]: Référence tsconfig — paths | https://www.typescriptlang.org/fr/tsconfig#paths
[niveau]: avancé

### Quelle règle `typescript-eslint` détecte une Promise ni attendue ni gérée ?
- [ ] `no-explicit-any`
- [x] `@typescript-eslint/no-floating-promises`
- [ ] `no-unused-vars`
- [ ] `prefer-const`
> Une promesse « flottante » peut rejeter sans handler (crash Node) ou s'exécuter dans un ordre inattendu. Cette règle nécessite le linting typé (`parserOptions.project` / `projectService`).
[doc]: typescript-eslint — no-floating-promises (EN) | https://typescript-eslint.io/rules/no-floating-promises/

### À quoi servent `@types/xxx` ?
- [ ] À ajouter des tests à une librairie
- [x] À fournir les déclarations TypeScript d'une librairie JS qui n'en embarque pas (projet DefinitelyTyped)
- [ ] À compiler une librairie en TypeScript
- [ ] À installer une version typée différente de la librairie
> Exemple : `express` est en JS, ses types sont dans `@types/express`. Les librairies modernes embarquent souvent leurs propres `.d.ts` (champ `types` ou `exports` dans `package.json`).
[doc]: Handbook — Consommer des déclarations (EN) | https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html
[niveau]: facile

### Quelles données doivent être validées à l'exécution, même dans un projet 100 % TypeScript ? (plusieurs réponses)
- [x] Le body et les query params d'une requête HTTP
- [x] Les variables d'environnement
- [x] La réponse d'une API tierce
- [ ] Les arguments passés entre deux fonctions internes typées
> Tout ce qui franchit une **frontière** du système (réseau, env, fichiers, stockage, librairies non typées) doit être validé. À l'intérieur, le compilateur suffit. En NestJS, `ConfigModule` + un schéma (Joi/Zod) valide l'env au démarrage.
[doc]: NestJS — Configuration, schema validation (EN) | https://docs.nestjs.com/techniques/configuration#schema-validation
[doc]: NestJS — Configuration, schema validation (FR) | https://docs.nest-js.fr/techniques/configuration
[niveau]: facile

### À quoi sert `esModuleInterop` ?
- [ ] À convertir automatiquement le projet en ESM
- [x] À importer correctement un module CommonJS (`module.exports = …`) avec `import express from 'express'`
- [ ] À autoriser `require` dans un fichier `.ts`
- [ ] À générer des fichiers `.d.ts`
> Sans cette option, il fallait écrire `import * as express from 'express'`, ce qui ne correspond pas au comportement réel des bundlers et de Node. `esModuleInterop` ajoute des helpers d'interopérabilité et active `allowSyntheticDefaultImports`.
[doc]: tsconfig — esModuleInterop | https://www.typescriptlang.org/fr/tsconfig#esModuleInterop
[niveau]: avancé

### Que fait `skipLibCheck: true` ?
- [ ] Il ne compile pas `node_modules`
- [x] Il saute la vérification de type des fichiers de déclaration `.d.ts`
- [ ] Il ignore les erreurs dans les fichiers de test
- [ ] Il désactive `@types`
> Option quasi systématique : elle accélère la compilation et évite des conflits entre des `@types` incompatibles. Contrepartie : une vraie erreur dans vos propres `.d.ts` passera inaperçue.
[doc]: tsconfig — skipLibCheck | https://www.typescriptlang.org/fr/tsconfig#skipLibCheck

### Un projet Vite compile et tourne malgré une erreur de type évidente. Pourquoi ?
- [ ] Vite désactive le mode `strict`
- [x] Vite (via esbuild) retire les types sans les vérifier : il faut lancer `tsc --noEmit` à part
- [ ] Les erreurs de type sont des warnings en développement
- [ ] Vite ne supporte pas TypeScript
> esbuild, swc ou Babel font de la **transpilation seule** pour être rapides. La vérification de type reste le travail de `tsc` (dans l'éditeur, en script `typecheck` et surtout en CI). Le `npm run build` de ce projet enchaîne justement `tsc -b` puis `vite build`.
[doc]: Vite — TypeScript (transpilation seule) | https://vite.dev/guide/features.html#typescript

### Qu'impose `verbatimModuleSyntax: true` ?
- [ ] Les imports doivent avoir une extension `.js`
- [x] Les imports de types doivent être marqués `type` ; les autres sont conservés tels quels dans le JS émis
- [ ] Les exports par défaut sont interdits
- [ ] Le code est émis sans modification
> La règle est simple : ce qui n'est pas marqué `type` est émis, ce qui l'est est effacé. Plus aucune élision « magique » d'imports, ce qui rend le comportement prévisible pour les outils qui transpilent fichier par fichier.
[doc]: tsconfig — verbatimModuleSyntax | https://www.typescriptlang.org/fr/tsconfig#verbatimModuleSyntax
[niveau]: avancé

### Quand choisir `moduleResolution: "bundler"` ?
- [ ] Pour une librairie publiée sur npm et exécutée directement par Node
- [x] Pour du code traité par un bundler (Vite, webpack) : imports relatifs sans extension et prise en charge de `exports`
- [ ] Pour un backend NestJS compilé avec `tsc`
- [ ] Jamais, c'est déprécié
> `bundler` imite la résolution des bundlers modernes. Pour du code exécuté par Node sans bundler (API, CLI, librairie), `nodenext` est plus fidèle et impose les extensions explicites.
[doc]: TypeScript — Choisir les options de modules (EN) | https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html
[niveau]: avancé

### Une librairie déclare `"exports": { ".": "./dist/index.js" }` dans son `package.json`. Que devient `import x from 'lib/dist/utils.js'` ?
- [ ] Il fonctionne normalement
- [x] Il échoue : seuls les points d'entrée listés dans `exports` sont importables
- [ ] Il est redirigé vers `./dist/index.js`
- [ ] Il fonctionne uniquement en CommonJS
> Le champ `exports` définit l'**API publique** du paquet et bloque les imports profonds non déclarés. Il permet aussi de servir des fichiers différents selon les conditions (`import`, `require`, `types`).
[doc]: Node.js — Package entry points (EN) | https://nodejs.org/api/packages.html#package-entry-points
[niveau]: avancé

### Que vaut `z.coerce.number().parse('')` avec Zod ?
- [ ] Une erreur de validation
- [x] `0`
- [ ] `NaN`
- [ ] `undefined`
> `z.coerce.number()` applique `Number(valeur)` avant validation, pratique pour les query params (toujours des chaînes). Mais `Number('') === 0` : un champ vide devient zéro. Pour un champ obligatoire, mieux vaut valider la chaîne d'abord (ex. `z.string().min(1).pipe(z.coerce.number())`).
[doc]: Zod — Coercion (EN) | https://zod.dev/api#coercion
[niveau]: avancé

### Quel est l'inconvénient d'un « barrel » `index.ts` qui réexporte tout un dossier ?
- [ ] Il empêche l'utilisation de `import type`
- [x] Importer un seul élément peut charger tout le dossier, ralentir les tests et favoriser les imports circulaires
- [ ] Il est incompatible avec ESM
- [ ] Il double la taille du bundle de production
> Un barrel est pratique pour l'API publique d'un package, mais dans une application il oblige l'outillage (Jest, Vite en dev, tsserver) à évaluer chaque module réexporté. Préférez des imports directs à l'intérieur d'une même base de code.
[doc]: TypeScript — Modules | https://www.typescriptlang.org/fr/docs/handbook/2/modules.html
