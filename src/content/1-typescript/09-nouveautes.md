---
id: ts-nouveautes
track: typescript
order: 9
title: Nouveautés de TypeScript 5.x, 6.0 et 7.0
level: Avancé
summary: Ce qui a changé depuis TS 5.0 — décorateurs standard, using, NoInfer, prédicats inférés, erasableSyntaxOnly — puis la transition 6.0 et le compilateur natif en Go de TS 7.
---

## Pourquoi suivre les versions

TypeScript sort une version mineure tous les 3 à 4 mois. En entretien senior, on attend qu'on sache **ce qui a changé récemment** et **ce que ça implique pour un projet** : nouvelles options tsconfig, valeurs par défaut modifiées, migration vers le compilateur natif.

| Version | Date | En une phrase |
| --- | --- | --- |
| 5.0 | mars 2023 | décorateurs standard, `const` sur les paramètres de type, `moduleResolution: bundler` |
| 5.2 | août 2023 | `using` (gestion explicite des ressources) |
| 5.4 | mars 2024 | `NoInfer<T>`, narrowing conservé dans les closures |
| 5.5 | juin 2024 | prédicats de type **inférés**, `isolatedDeclarations` |
| 5.6 – 5.7 | 2024 | contrôles « toujours vrai », helpers d'itérateurs, `rewriteRelativeImportExtensions` |
| 5.8 | mars 2025 | `erasableSyntaxOnly` (pour le *type stripping* de Node) |
| 5.9 | août 2025 | `import defer`, `module: node20`, nouveau `tsc --init` |
| **6.0** | mars 2026 | dernière version en JavaScript : nouveaux défauts, grand ménage des options |
| **7.0** | juillet 2026 | compilateur et language service **réécrits en Go** (~10× plus rapides) |
| 7.1 | bêta oct. 2026 | retour d'une API programmatique, `es2026` |

## TypeScript 5.0 → 5.4

### Décorateurs standard (5.0)

TS 5.0 implémente les décorateurs **TC39** (stage 3), différents des décorateurs « expérimentaux » historiques :

```ts
function log<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => R>,
) {
  return function (this: This, ...args: Args): R {
    console.log(`→ ${String(context.name)}`);
    return target.call(this, ...args);
  };
}

class Service {
  @log
  run() {}
}
```

- Signature `(valeur, context)` au lieu de `(target, key, descriptor)`.
- Pas de décorateurs de **paramètres** et pas d'`emitDecoratorMetadata` : NestJS, TypeORM, class-validator dépendent encore de `experimentalDecorators: true`.

### Paramètres de type `const` (5.0)

```ts
function routes<const T extends readonly string[]>(paths: T) { return paths; }
const r = routes(['/a', '/b']);   // readonly ["/a", "/b"] au lieu de string[]
```

### `using` et `Symbol.dispose` (5.2)

```ts
function ouvrir(path: string) {
  const handle = fs.openSync(path, 'r');
  return { handle, [Symbol.dispose]: () => fs.closeSync(handle) };
}

{
  using f = ouvrir('data.txt');
  // ... f.handle
}   // f[Symbol.dispose]() appelé automatiquement, même en cas d'exception

await using conn = await pool.connect();   // version async : Symbol.asyncDispose
```

L'équivalent d'un `try/finally` rangé avec la ressource. Supporté nativement par V8 13.6 (Node 24+).

### Import attributes (5.3)

```ts
import config from './config.json' with { type: 'json' };
```

`with` remplace l'ancienne syntaxe `assert { type: 'json' }`, devenue une **erreur** en TS 6.0.

### `NoInfer<T>` (5.4)

```ts
function creerFeu<C extends string>(couleurs: C[], defaut: NoInfer<C>) {}
creerFeu(['rouge', 'vert'], 'bleu');   // ❌ — sans NoInfer, C serait élargi à "rouge" | "vert" | "bleu"
```

`NoInfer` empêche un argument de participer à l'inférence : il doit se conformer au type inféré ailleurs.

5.4 conserve aussi le **narrowing dans les closures** créées après la dernière affectation d'une variable `let`.

## TypeScript 5.5 → 5.9

### Prédicats de type inférés (5.5)

```ts
const ids = [1, undefined, 3].filter((x) => x !== undefined);
// TS ≤ 5.4 : (number | undefined)[]
// TS ≥ 5.5 : number[] — la flèche est inférée comme (x) => x is number
```

TS déduit un prédicat `x is T` quand la fonction retourne un booléen qui affine son paramètre. Plus besoin d'écrire `(x): x is number => …` dans la plupart des `filter`.

Autres ajouts 5.5 : vérification de la **syntaxe des regex**, `isolatedDeclarations` (des `.d.ts` générables fichier par fichier, sans inférence globale — utile aux monorepos), `@import` en JSDoc.

### Contrôles « toujours vrai / toujours nul » (5.6)

```ts
if (/^\d+$/) {}          // ❌ erreur : une regex est toujours truthy (on a oublié .test(...))
if (x => 0) {}           // ❌ une fonction est toujours truthy
const v = a < b ?? 0;    // ❌ le membre de gauche n'est jamais nullish
```

5.6 type aussi les **helpers d'itérateurs** (`iter.map().filter().take()`) via `IteratorObject`, et ajoute `--noUncheckedSideEffectImports` (vérifie qu'un `import './styles.css'` pointe vers un fichier existant).

### 5.7

- Erreur sur les variables **jamais initialisées** lues dans une fonction imbriquée.
- `--rewriteRelativeImportExtensions` : `import './util.ts'` est réécrit en `./util.js` à l'émission.
- `--target es2024`.

### `erasableSyntaxOnly` (5.8)

Node.js exécute désormais les fichiers `.ts` en **retirant les types** (*type stripping*, voir le parcours Node.js). Il ne sait pas traduire la syntaxe TS qui produit du JavaScript :

```ts
enum Role { Admin, User }                     // ❌ génère un objet
namespace Utils { export const x = 1; }       // ❌ génère du code
class A { constructor(private repo: Repo) {} } // ❌ parameter property
```

`erasableSyntaxOnly: true` interdit ces constructions pour garantir que le fichier est exécutable tel quel. Alternatives : union de littéraux ou objet `as const` au lieu d'`enum`, propriétés déclarées explicitement.

5.8 a aussi fiabilisé `require()` d'un module ESM sous `module: nodenext` (comme Node 22+) et ajouté des contrôles plus fins sur les branches d'un `return cond ? a : b`.

### 5.9

- `import defer * as lourd from './lourd.js'` : le module n'est **évalué** qu'au premier accès à une propriété.
- `--module node20` : un mode stable qui reflète Node 20+, contrairement à `nodenext` qui évolue.
- `tsc --init` génère un tsconfig minimal et moderne : `module: nodenext`, `target: esnext`, `strict`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck`.

## TypeScript 6.0 : la version de transition

6.0 (mars 2026) est la **dernière version écrite en JavaScript**. Son rôle : aligner le comportement sur TS 7 pour que la migration soit indolore.

### Nouvelles valeurs par défaut

| Option | Avant | 6.0 / 7.0 |
| --- | --- | --- |
| `strict` | `false` | **`true`** |
| `module` | `commonjs` | `esnext` |
| `target` | `es5` | dernière version ES stable (`es2025`) |
| `types` | tous les `@types/*` | **`[]`** → ajouter `"types": ["node"]` |
| `rootDir` | déduit des fichiers | dossier du `tsconfig.json` |
| `noUncheckedSideEffectImports` | `false` | `true` |

Le piège le plus fréquent : `types: []`. Un projet Node qui n'avait jamais listé `@types/node` voit soudain `process` ou `Buffer` inconnus.

### Dépréciations (supprimées en 7.0)

- `target: es5` et `downlevelIteration` → la cible minimale est ES2015.
- `moduleResolution: node` (alias `node10`) et `classic` → utiliser `nodenext` ou `bundler`.
- `module: amd | umd | systemjs | none` et `outFile`.
- `baseUrl` → `paths` doit contenir des chemins relatifs au tsconfig.
- `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, `alwaysStrict: false` → impossibles.
- `module Foo {}` pour un namespace → `namespace Foo {}`.
- `import … assert {}` → `with {}`.

`"ignoreDeprecations": "6.0"` masque temporairement les avertissements, mais TS 7 refuse ces options.

### Ajouts

`--target es2025`, types de **Temporal**, `RegExp.escape`, `Map.prototype.getOrInsert`, imports de sous-chemins commençant par `#/`, `dom.iterable` fusionné dans `dom`, et `--stableTypeOrdering` pour reproduire l'ordre des types de TS 7.

## TypeScript 7.0 : le compilateur natif

Le compilateur (projet *Corsa*, dépôt `typescript-go`) a été **porté en Go**. Ce n'est pas une réécriture du langage : mêmes règles de typage, mêmes erreurs, mais un binaire natif et parallèle.

```bash
npm install -D typescript   # 7.x : la commande reste `tsc`
npx tsc --checkers 8        # nombre de workers de type-check (4 par défaut)
npx tsc -b --builders 2     # builds de project references en parallèle
```

- **8 à 12× plus rapide** sur des builds complets (VS Code : 125 s → 10,6 s), mémoire en baisse.
- Parsing, vérification et émission **parallélisés** (`--singleThreaded` pour désactiver).
- Language service réécrit sur **LSP**, multi-thread : ouverture d'un gros projet en une seconde au lieu de quinze.
- Le paquet de préversion `@typescript/native-preview` (commande `tsgo`) a servi pendant la bêta ; aujourd'hui c'est simplement `typescript`.

### Les limites de la 7.0

- **Pas d'API programmatique** : les outils qui importent `typescript` comme bibliothèque (typescript-eslint, Volar pour Vue, Svelte, Astro, MDX, vérification des templates Angular) restent sur 6.0. Le paquet `@typescript/typescript6` (commande `tsc6`) permet de garder les deux côte à côte.
- Inférence des template literals par **point de code Unicode** (`"😀"` n'est plus coupé en deux demi-paires) : certains types utilitaires `Length<S>` changent de résultat.
- Le support de **JSDoc** est plus strict (plus de `@enum` spécial, plus de type `?` seul…).

TS **7.1** (bêta en octobre 2026) réintroduit une API, découpée en points d'entrée (`typescript/sync`, `typescript/async`…), pour débloquer cet outillage.

### Migrer un projet

1. Passer en **6.0** et corriger les dépréciations sans `ignoreDeprecations`.
2. Rendre explicites les options dont le défaut change (`types`, `rootDir`, `module`, `target`).
3. Tester 7.0 en CI (`tsc --noEmit`), garder 6.0 pour les outils qui en dépendent.
4. NestJS : `experimentalDecorators` et `emitDecoratorMetadata` restent supportés, mais le build par `tsc` passe alors par le compilateur natif — gain direct sur les gros monorepos.

## Pour aller plus loin

- [Notes de version TypeScript (EN)](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
- [Announcing TypeScript 6.0 (EN)](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Announcing TypeScript 7.0 (EN)](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [typescript-go — CHANGES.md (EN)](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)

<!-- QUIZ -->

### Dans quel langage le compilateur de TypeScript 7.0 a-t-il été réécrit ?
- [ ] Rust
- [x] Go
- [ ] C++
- [ ] Il est toujours écrit en TypeScript
> TS 7.0 est un **port en Go** du compilateur et du language service (projet *Corsa*). Le langage ne change pas : seul l'outil devient un binaire natif, parallèle et bien plus rapide.
[doc]: Announcing TypeScript 7.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
[niveau]: facile

### Quelle méthode un objet doit-il exposer pour être utilisable avec `using` ?
- [ ] `close()`
- [x] `[Symbol.dispose]()`
- [ ] `dispose()`
- [ ] `[Symbol.iterator]()`
> `using` appelle `[Symbol.dispose]()` à la sortie du bloc. Pour la version `await using`, c'est `[Symbol.asyncDispose]()`, qui renvoie une Promise.
[doc]: TypeScript 5.2 — using Declarations (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
[niveau]: facile

### Avant TS 5.5, comment écrivait-on ce `filter` pour obtenir un `number[]` ?
```ts
const ids = [1, undefined, 3].filter(/* ??? */);
```
- [ ] `(x) => x !== undefined as number`
- [x] `(x): x is number => x !== undefined`
- [ ] `(x) => x is number`
- [ ] `<number>(x) => x !== undefined`
> Un **prédicat de type** `x is number` dans le type de retour indique à TS que, si la fonction renvoie `true`, `x` est un `number`. Depuis TS 5.5, il est inféré automatiquement dans les cas simples comme celui-ci.
[doc]: TypeScript 5.5 — Inferred Type Predicates (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html
[niveau]: facile

### Avec `erasableSyntaxOnly`, par quoi peut-on remplacer un `enum` ? (plusieurs réponses)
- [x] Une union de littéraux : `type Role = 'admin' | 'user'`
- [x] Un objet `as const` : `const Role = { Admin: 'admin', User: 'user' } as const`
- [ ] Un `namespace Role`
- [ ] Un `const enum Role`
> Une union de littéraux est purement un type, donc effaçable. Un objet `as const` est du JavaScript ordinaire, avec un type dérivé (`(typeof Role)[keyof typeof Role]`). `namespace` et `const enum` génèrent ou remplacent du code : ils sont refusés eux aussi.
[doc]: TypeScript 5.8 — erasableSyntaxOnly (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html
[niveau]: facile

### Que fait Node.js quand il exécute directement un fichier `.ts` (*type stripping*) ?
- [ ] Il vérifie les types puis exécute le code
- [x] Il retire les annotations de type sans les vérifier, puis exécute le JavaScript restant
- [ ] Il appelle `tsc` en arrière-plan
- [ ] Il convertit les types en vérifications à l'exécution
> Node se contente d'effacer les types : aucune vérification n'a lieu. Il faut donc toujours lancer `tsc --noEmit` (en CI, dans l'éditeur). C'est pour garantir que cet effacement suffit qu'existe `erasableSyntaxOnly`.
[doc]: TypeScript 5.8 — erasableSyntaxOnly (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html
[niveau]: facile

### Quelle est la particularité de TypeScript 6.0 ?
- [ ] Elle introduit le compilateur en Go
- [x] C'est la dernière version écrite en JavaScript, qui prépare la migration vers 7.0
- [ ] Elle supprime le mode `strict`
- [ ] Elle ajoute la vérification des types à l'exécution
> 6.0 est une version de **transition** : elle adopte les nouvelles valeurs par défaut et déprécie les options que 7.0 supprimera. Corriger ses avertissements rend la bascule vers le compilateur natif presque transparente.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: facile

### Quelle option `tsconfig` active les décorateurs « historiques » dont dépend NestJS ?
- [ ] `"decorators": true`
- [x] `"experimentalDecorators": true`
- [ ] `"strict": true`
- [ ] Aucune, ils sont activés par défaut depuis TS 5.0
> Sans option, TS 5.0+ compile les décorateurs **standard** (TC39). `experimentalDecorators` revient à l'ancien modèle, accompagné d'`emitDecoratorMetadata`, nécessaire à l'injection de dépendances de NestJS.
[doc]: TypeScript 5.0 — Decorators (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
[niveau]: facile

### Que fait `"ignoreDeprecations": "6.0"` dans un `tsconfig.json` ?
- [ ] Il corrige automatiquement les options dépréciées
- [x] Il masque temporairement les avertissements de dépréciation de TS 6.0, mais TS 7.0 refusera quand même ces options
- [ ] Il fait tourner TS 7 en mode compatible 6.0
- [ ] Il désactive le mode `strict`
> C'est une solution d'attente, pas une migration : les options dépréciées en 6.0 sont supprimées en 7.0. La bonne démarche est de les corriger tant qu'on est en 6.0.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: facile

### Depuis TS 5.9, que produit `tsc --init` ?
- [ ] Un `tsconfig.json` de plusieurs centaines de lignes commentées, en mode non strict
- [x] Un `tsconfig.json` court et moderne : `strict`, `module: nodenext`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`…
- [ ] Un projet complet avec `package.json` et dossier `src`
- [ ] Un fichier `.d.ts`
> Le nouveau `tsc --init` part des réglages recommandés aujourd'hui plutôt que d'une longue liste d'options commentées. C'est un bon point de départ pour un nouveau projet.
[doc]: TypeScript 5.9 — Support for --module node20 (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html
[niveau]: facile

### Ton `tsconfig.json` contient `"target": "es5"`. Que se passe-t-il avec TS 7.0 ?
- [ ] Rien, ES5 reste la valeur par défaut
- [x] L'option est refusée : la cible minimale est désormais ES2015
- [ ] TS 7 émet automatiquement de l'ES2015 sans prévenir
- [ ] Le code est émis en ES3
> `target: es5` est déprécié en 6.0 et supprimé en 7.0 : tous les environnements actuels supportent au moins ES2015 (classes, `let`/`const`, flèches). Il suffit de choisir une cible moderne comme `es2022`.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: facile

### Que garantit `using` dans ce code ?
```ts
{
  using conn = ouvrirConnexion();
  traiter(conn);
}
```
- [ ] `conn` est immuable
- [x] `conn[Symbol.dispose]()` est appelé à la sortie du bloc, même si `traiter` lève une exception
- [ ] La connexion est mise en cache pour le bloc suivant
- [ ] `conn` est libérée par le garbage collector immédiatement
> `using` (TS 5.2, proposition *Explicit Resource Management*) appelle `Symbol.dispose` en fin de portée, dans l'ordre inverse des déclarations. C'est un `try/finally` attaché à la ressource. `await using` fait la même chose avec `Symbol.asyncDispose`.
[doc]: TypeScript 5.2 — using Declarations (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
[niveau]: facile

### Depuis TS 5.5, quel est le type de `ids` ?
```ts
const ids = [1, undefined, 3].filter((x) => x !== undefined);
```
- [ ] `(number | undefined)[]`
- [x] `number[]`
- [ ] `unknown[]`
- [ ] `(1 | 3)[]`
> TS 5.5 **infère des prédicats de type** : la flèche `(x) => x !== undefined` est typée `(x) => x is number`, donc la surcharge de `filter` qui affine le tableau s'applique. Avant, il fallait écrire le prédicat à la main.
[doc]: TypeScript 5.5 — Inferred Type Predicates (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html

### Que fait `NoInfer` ici ?
```ts
function choisir<T extends string>(options: T[], defaut: NoInfer<T>) {}
choisir(['a', 'b'], 'c');
```
- [ ] Rien, `NoInfer` est un alias de `T`
- [x] `T` est inféré uniquement depuis `options` (`"a" | "b"`), donc `'c'` est une erreur
- [ ] `T` devient `string`
- [ ] Il désactive la vérification de `defaut`
> Sans `NoInfer`, TS utiliserait aussi `'c'` comme candidat et élargirait `T` à `"a" | "b" | "c"` : aucune erreur. `NoInfer<T>` (TS 5.4) exclut une position de l'inférence.
[doc]: TypeScript 5.4 — NoInfer (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html
[niveau]: avancé

### Quel est le type de `r` ?
```ts
function liste<const T extends readonly string[]>(x: T) { return x; }
const r = liste(['GET', 'POST']);
```
- [ ] `string[]`
- [x] `readonly ["GET", "POST"]`
- [ ] `("GET" | "POST")[]`
- [ ] `any[]`
> Un paramètre de type `const` (TS 5.0) infère comme si l'argument était suivi de `as const` : littéraux et tuples conservés. La contrainte `readonly` est nécessaire, sinon l'inférence retombe sur un tableau mutable.
[doc]: TypeScript 5.0 — const Type Parameters (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
[niveau]: avancé

### Pourquoi NestJS utilise-t-il toujours `experimentalDecorators: true` malgré les décorateurs standard de TS 5.0 ?
- [ ] Les décorateurs standard sont plus lents
- [x] Les décorateurs standard ne supportent ni les décorateurs de paramètres ni `emitDecoratorMetadata`, dont dépend l'injection de dépendances
- [ ] Les décorateurs standard n'existent qu'en JavaScript
- [ ] NestJS n'a pas encore migré vers TS 5
> `@Inject()` dans un constructeur est un décorateur de **paramètre**, et la DI lit les types via `design:paramtypes` (émis par `emitDecoratorMetadata`). Aucun des deux n'existe dans la proposition TC39. Les deux modèles coexistent : l'option choisit lequel TS compile.
[doc]: TypeScript 5.0 — Decorators (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html

### Que signale TS 5.6 ici ?
```ts
if (/^\d+$/) {
  enregistrer(valeur);
}
```
- [ ] Rien, le code est valide
- [x] Une erreur : une expression régulière littérale est toujours truthy (on a probablement oublié `.test(valeur)`)
- [ ] Une erreur de syntaxe de regex
- [ ] Un avertissement de performance
> TS 5.6 refuse les conditions dont le résultat est connu à la compilation : regex, fonctions, objets littéraux toujours truthy, ou `??` dont le membre gauche n'est jamais nullish. Ce sont presque toujours des bugs.
[doc]: TypeScript 5.6 — Disallowed Nullish and Truthy Checks (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html
[niveau]: facile

### Avec `erasableSyntaxOnly: true`, lesquelles de ces constructions sont refusées ? (plusieurs réponses)
- [x] `enum Statut { Actif, Inactif }`
- [x] `class A { constructor(private readonly repo: Repo) {} }`
- [x] `namespace Config { export const port = 3000; }`
- [ ] `type Statut = 'actif' | 'inactif'`
> Ces trois syntaxes **génèrent du JavaScript** : un objet pour l'enum, une affectation `this.repo = repo`, un IIFE pour le namespace. Le *type stripping* de Node ne fait que remplacer les types par des espaces : il ne peut pas les exécuter. Les alias de type, interfaces et annotations sont effaçables.
[doc]: TypeScript 5.8 — erasableSyntaxOnly (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html

### Que fait `--rewriteRelativeImportExtensions` (TS 5.7) ?
- [ ] Il ajoute `.js` aux imports sans extension
- [x] Il réécrit `import './util.ts'` en `import './util.js'` dans le JS émis
- [ ] Il convertit les imports CommonJS en ESM
- [ ] Il résout les alias de `paths`
> Avec cette option, on peut écrire des imports en `.ts` — ce qu'exige Node quand il exécute directement les sources — tout en émettant du JS correct pour la production. Seuls les chemins **relatifs** sont réécrits.
[doc]: TypeScript 5.7 — Path Rewriting for Relative Paths (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html

### Quelle est la bonne syntaxe pour importer un JSON en ESM, valide en TS 6.0 ?
- [ ] `import data from './data.json' assert { type: 'json' }`
- [x] `import data from './data.json' with { type: 'json' }`
- [ ] `import data from './data.json?json'`
- [ ] `import json data from './data.json'`
> Les *import attributes* (`with`) ont remplacé les *import assertions* (`assert`). TS les supporte depuis 5.3 ; `assert` est une erreur depuis 6.0. Node exige l'attribut pour importer du JSON en ESM.
[doc]: TypeScript 5.3 — Import Attributes (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html
[niveau]: facile

### Que fait `import defer` (TS 5.9) ?
```ts
import defer * as rapport from './rapport-lourd.js';
```
- [ ] Il charge le module en arrière-plan dans un worker
- [x] Le module est chargé mais n'est **évalué** qu'au premier accès à l'une de ses propriétés
- [ ] Il équivaut à `await import()`
- [ ] Il n'importe que les types
> `import defer` (proposition TC39) retarde l'exécution d'un module coûteux sans rendre le code asynchrone. Seule la forme espace de noms (`* as`) est autorisée, et l'option `module` doit être `esnext` ou `preserve`.
[doc]: TypeScript 5.9 — import defer (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html
[niveau]: avancé

### Un projet Node passe de TS 5.9 à 6.0 sans toucher son tsconfig, et `process` devient inconnu. Pourquoi ?
- [ ] `@types/node` est déprécié
- [x] `types` vaut désormais `[]` par défaut : les paquets `@types/*` ne sont plus inclus automatiquement
- [ ] `strict` est activé par défaut
- [ ] TS 6.0 ne supporte plus Node
> Avant, TS chargeait tous les `@types/*` présents dans `node_modules`, ce qui ralentissait et polluait les projets. Il faut maintenant les lister : `"types": ["node"]`. `"types": ["*"]` restaure l'ancien comportement.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

### Quelles options sont dépréciées en TS 6.0 et refusées en 7.0 ? (plusieurs réponses)
- [x] `"target": "es5"`
- [x] `"moduleResolution": "node"`
- [x] `"baseUrl": "./src"`
- [ ] `"moduleResolution": "bundler"`
> La cible minimale devient ES2015 ; la résolution `node10` (sans `exports`) disparaît au profit de `nodenext` et `bundler` ; `baseUrl` n'est plus une racine de résolution (`paths` devient relatif au tsconfig). `ignoreDeprecations: "6.0"` ne fait que repousser le problème.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: avancé

### Quelles sont les valeurs par défaut de `strict` et `module` à partir de TS 6.0 ?
- [ ] `strict: false`, `module: commonjs`
- [x] `strict: true`, `module: esnext`
- [ ] `strict: true`, `module: nodenext`
- [ ] Elles n'ont pas de valeur par défaut, il faut les préciser
> 6.0 aligne les défauts sur les usages modernes : mode strict et ESM. Dans un tsconfig existant, ces options sont généralement déjà explicites ; le changement touche surtout les petits projets et les fichiers compilés sans config.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: facile

### Qu'est-ce qui change fondamentalement avec TypeScript 7.0 ?
- [ ] La syntaxe du langage
- [x] Le compilateur et le language service sont portés en Go : binaire natif, parallèle, 8 à 12× plus rapide
- [ ] TypeScript devient un runtime comme Node
- [ ] Les types sont vérifiés à l'exécution
> Le port natif (projet *Corsa*) conserve la sémantique du langage. Le gain vient du code natif, de la mémoire partagée et du parallélisme (`--checkers`, `--builders`). La commande reste `tsc`, installée via le paquet `typescript`.
[doc]: Announcing TypeScript 7.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
[niveau]: facile

### Une équipe passe à TS 7.0 et son lint typé (typescript-eslint) casse. Pourquoi, et que faire ?
- [ ] typescript-eslint ne supporte pas le mode strict
- [x] TS 7.0 ne fournit pas d'API programmatique ; on garde TS 6.0 pour les outils (via `@typescript/typescript6`) et on utilise 7.0 pour `tsc`
- [ ] Il faut réécrire les règles ESLint en Go
- [ ] Il faut désactiver `--checkers`
> Les outils qui importent `typescript` comme bibliothèque (typescript-eslint, Volar pour Vue, Svelte, Astro, Angular templates) attendent l'ancienne API. 7.0 n'en a pas ; 7.1 en réintroduit une nouvelle. En attendant, les deux versions cohabitent.
[doc]: Announcing TypeScript 7.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

### Que contrôle l'option `--checkers` de TS 7 ?
- [ ] Le nombre de règles de lint actives
- [x] Le nombre de workers de vérification de types exécutés en parallèle (4 par défaut)
- [ ] Le niveau de sévérité des erreurs
- [ ] Le nombre de fichiers vérifiés
> Plus de checkers = plus rapide sur une machine multi-cœurs, mais plus de mémoire. `--builders` parallélise en plus les *project references* sous `tsc -b`. `--singleThreaded` désactive tout parallélisme (débogage, CI très contrainte).
[doc]: Announcing TypeScript 7.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

### Quel était le rôle de la commande `tsgo` ?
- [ ] Un compilateur TypeScript vers Go
- [x] La préversion du compilateur natif (paquet `@typescript/native-preview`) avant la sortie de TS 7.0
- [ ] Un runtime TypeScript concurrent de Deno
- [ ] Un outil de migration de TS 6 vers TS 7
> Pendant la bêta, le compilateur natif était distribué séparément pour être testé à côté de `tsc`. Depuis 7.0, il **est** `tsc`, dans le paquet `typescript` ; les nightlies reviennent sous `typescript@next`.
[doc]: Announcing TypeScript 7.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

### Quelle est la stratégie de migration recommandée vers TS 7 ?
- [ ] Passer directement de 5.x à 7.0 et corriger les erreurs
- [x] Passer d'abord en 6.0, corriger toutes les dépréciations sans `ignoreDeprecations`, puis basculer en 7.0
- [ ] Attendre que TS 7 supporte `target: es5`
- [ ] Convertir le projet en JavaScript
> 6.0 existe précisément pour ça : même comportement que 7.0, mais avec des avertissements au lieu d'erreurs, et la possibilité de reproduire l'ordre des types de 7.0 (`--stableTypeOrdering`). Une fois le projet propre en 6.0, la bascule en 7.0 est presque transparente.
[doc]: Announcing TypeScript 6.0 (EN) | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
[niveau]: facile

### Que vérifie `--noUncheckedSideEffectImports` (activé par défaut depuis 6.0) ?
```ts
import './styles.css';
import './polyfills';
```
- [ ] Que les fichiers importés n'ont pas d'effets de bord
- [x] Que ces imports « pour effet de bord » pointent vers un module résolvable
- [ ] Que les CSS sont typées
- [ ] Que les imports sont triés
> Avant, TS ignorait silencieusement un import sans liaison qu'il ne trouvait pas : une faute de frappe passait inaperçue. Pour les CSS dans un projet bundler, il faut une déclaration `declare module '*.css'` (fournie par `vite/client`).
[doc]: TypeScript 5.6 — noUncheckedSideEffectImports (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html
[niveau]: avancé

### À quoi sert `isolatedDeclarations` (TS 5.5) ?
- [ ] À interdire les `declare` globaux
- [x] À exiger des annotations explicites sur les exports, pour que les `.d.ts` soient générables fichier par fichier sans le type-checker
- [ ] À isoler les tests des sources
- [ ] À générer un `.d.ts` par fonction
> Sans inférence globale, des outils rapides (swc, oxc, esbuild) peuvent produire les déclarations en parallèle : utile dans les gros monorepos où la génération des `.d.ts` bloque les builds en cascade.
[doc]: TypeScript 5.5 — Isolated Declarations (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html
[niveau]: avancé

### Pourquoi `--module node20` a-t-il été ajouté en 5.9 alors que `nodenext` existe ?
- [ ] `nodenext` est déprécié
- [x] `nodenext` suit la dernière version de Node et peut changer entre deux versions de TS ; `node20` est un comportement figé et prévisible
- [ ] `node20` active le type stripping
- [ ] `node20` n'autorise que CommonJS
> `nodenext` est volontairement « flottant ». Pour une librairie ou une CI qui veut un comportement stable, `node20` décrit précisément Node 20+ (dont `require()` d'ESM). TS 5.8 avait introduit `node18` dans le même esprit.
[doc]: TypeScript 5.9 — Support for --module node20 (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html
[niveau]: avancé
