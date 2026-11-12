---
id: ts-bases
track: typescript
order: 1
title: Les bases du système de types
level: Débutant
summary: Ce que fait vraiment TypeScript, l'inférence, le typage structurel, any / unknown / never, les littéraux.
---

## TypeScript en une phrase

TypeScript est **JavaScript + un système de types statique**. Le compilateur (`tsc`) vérifie les types puis **efface** toutes les annotations : ce qui tourne dans Node ou le navigateur est du JavaScript pur. Conséquence capitale :

> Les types n'existent **pas à l'exécution**. On ne peut pas faire `if (x instanceof MonInterface)` : une interface ne laisse aucune trace dans le JS généré.

C'est pour cela qu'en NestJS on valide les entrées HTTP avec des **classes** (qui, elles, existent au runtime) et `class-validator`, et pas avec des interfaces.

## Types primitifs et inférence

```ts
let nom: string = 'Ada';
let age = 36;            // inféré : number
const role = 'admin';    // inféré : 'admin' (type littéral, car const)
let actif = true;        // boolean
let id: bigint = 10n;
let cle: symbol = Symbol('k');
```

Règle pratique : **laisse TypeScript inférer** les variables locales, et **annote les frontières** (paramètres de fonctions, types de retour publics, props, DTO).

`let` élargit (*widening*) le type littéral vers le type primitif ; `const` le conserve.

## Tableaux, tuples et `as const`

```ts
const ids: number[] = [1, 2, 3];
const noms: Array<string> = ['a', 'b'];
const paire: [string, number] = ['age', 36];       // tuple : longueur et positions typées
const mixte = [1, 'a'];                            // (string | number)[]

const roles = ['admin', 'user'] as const;          // readonly ['admin', 'user']
type Role = (typeof roles)[number];                // 'admin' | 'user'
```

`as const` rend tout `readonly` et conserve les types littéraux : idéal pour dériver un type union depuis une liste de valeurs.

## Typage structurel

TypeScript compare les **formes**, pas les noms (*duck typing*) :

```ts
interface Point { x: number; y: number }
const p3 = { x: 1, y: 2, z: 3 };
const p: Point = p3;              // OK : p3 a au moins x et y

const q: Point = { x: 1, y: 2, z: 3 }; // ❌ excess property check
```

Le **contrôle des propriétés en trop** ne s'applique qu'aux **littéraux objet** affectés directement : c'est un garde-fou contre les fautes de frappe, pas une règle du typage structurel.

## any, unknown, never

| Type | Sens | Usage |
| --- | --- | --- |
| `any` | désactive le contrôle | à bannir (sauf migration) |
| `unknown` | « je ne sais pas encore » : il faut **affiner** avant d'utiliser | entrées externes, `catch (e)`, JSON parsé |
| `never` | aucune valeur possible | fonction qui lève toujours, exhaustivité des `switch` |

```ts
function parse(input: unknown) {
  input.toUpperCase();              // ❌ erreur
  if (typeof input === 'string') {
    input.toUpperCase();            // ✅ affiné en string
  }
}
function fail(msg: string): never {
  throw new Error(msg);
}
```

## null, undefined et `strict`

Avec `strictNullChecks` (inclus dans `strict: true`, **toujours activé** en projet pro), `null` et `undefined` ne sont plus assignables à tout type :

```ts
let titre: string = null;              // ❌
let sousTitre: string | null = null;   // ✅
interface User { email?: string }      // email : string | undefined
```

- `?.` (chaînage optionnel) : `user?.adresse?.ville`
- `??` (coalescence) : `port ?? 3000` — ne remplace que `null`/`undefined` (contrairement à `||` qui remplace aussi `0`, `''`, `false`).
- `!` (non-null assertion) : `el!.focus()` — dit au compilateur « fais-moi confiance », **aucune vérification à l'exécution**.

## `satisfies` (TS 4.9+)

```ts
type Config = Record<string, string | number>;

const a: Config = { port: 3000 };         // a.port : string | number (élargi)
const b = { port: 3000 } satisfies Config; // b.port : number (conservé) + validé
```

`satisfies` **vérifie** qu'une valeur respecte un type **sans changer** le type inféré.

## `{}`, `object` et `Object`

- `{}` : toute valeur **sauf** `null` et `undefined` (y compris `42` ou `'a'` !)
- `object` : toute valeur non primitive (objets, tableaux, fonctions)
- `Object` : quasi équivalent à `{}`, à éviter

Pour « un objet quelconque avec des clés » préfère `Record<string, unknown>`.

<!-- QUIZ -->

### Que reste-t-il des annotations de type dans le JavaScript généré par `tsc` ?
- [ ] Elles sont transformées en vérifications à l'exécution
- [x] Rien : elles sont effacées à la compilation
- [ ] Elles sont conservées sous forme de commentaires JSDoc exploitables au runtime
- [ ] Seules les interfaces sont conservées
> TypeScript pratique l'**effacement des types** (*type erasure*). Le JS produit ne contient aucune information de type : c'est pour cela qu'on ne peut pas tester une interface à l'exécution et qu'il faut des classes (+ `class-validator`) ou des schémas (Zod) pour valider des données venant de l'extérieur.
[doc]: Handbook — Les bases (types effacés) | https://www.typescriptlang.org/fr/docs/handbook/2/basic-types.html

### Ce code compile-t-il ?
```ts
interface Point { x: number; y: number }
const source = { x: 1, y: 2, z: 3 };
const p: Point = source;
```
- [x] Oui : `source` possède au moins les propriétés de `Point`
- [ ] Non : la propriété `z` est en trop
- [ ] Non : il faut un cast `as Point`
- [ ] Oui, mais `p.z` est accessible
> TypeScript est **structurel** : un type est compatible s'il possède *au moins* les propriétés attendues. Le contrôle des propriétés en trop (*excess property check*) ne s'applique qu'aux **littéraux objet** directement affectés. Et `p.z` n'est pas accessible car `p` est typé `Point`.
[doc]: Handbook — Typage structurel | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Ce code compile-t-il ?
```ts
interface Point { x: number; y: number }
const p: Point = { x: 1, y: 2, z: 3 };
```
- [ ] Oui, le typage est structurel
- [x] Non : « Object literal may only specify known properties »
- [ ] Oui, mais avec un warning
- [ ] Non, car `Point` n'est pas une classe
> Pour un **littéral objet** affecté directement à un type, TS active l'*excess property check* : une propriété inconnue est très probablement une faute de frappe. Passer par une variable intermédiaire contourne ce contrôle.
[doc]: Handbook — Excess property checks | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Quel type est inféré pour `role` ?
```ts
const role = 'admin';
```
- [ ] `string`
- [x] `'admin'`
- [ ] `any`
- [ ] `String`
> Une `const` ne peut pas être réassignée, donc TS conserve le **type littéral** `'admin'`. Avec `let role = 'admin'`, le type serait élargi (*widening*) en `string`.
[doc]: Handbook — Types littéraux | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Quel type faut-il préférer pour une valeur dont on ignore encore la forme (ex : `JSON.parse`, `catch (e)`) ?
- [ ] `any`
- [x] `unknown`
- [ ] `never`
- [ ] `object`
> `unknown` est le « any sûr » : on peut y assigner n'importe quoi, mais on ne peut rien en faire tant qu'on ne l'a pas **affiné** (`typeof`, `instanceof`, type guard, validation Zod…). `any` désactive tout contrôle et se propage silencieusement.
[doc]: Handbook — unknown | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quel est le type de retour le plus précis de cette fonction ?
```ts
function fail(message: string) {
  throw new Error(message);
}
```
- [ ] `void`
- [ ] `undefined`
- [x] `never`
- [ ] `Error`
> Une fonction qui **ne termine jamais normalement** (elle lève toujours, ou boucle à l'infini) a pour type de retour `never`. À noter : pour une déclaration de fonction, TS infère `void` ; il faut annoter `: never` explicitement pour que le contrôle de flux en tienne compte.
[doc]: Handbook — never | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quel est le type de `roles` ?
```ts
const roles = ['admin', 'user'] as const;
```
- [ ] `string[]`
- [ ] `('admin' | 'user')[]`
- [x] `readonly ['admin', 'user']`
- [ ] `['admin', 'user']`
> `as const` produit le type le plus étroit possible : tuple `readonly` de types littéraux. On peut ensuite dériver une union avec `(typeof roles)[number]` → `'admin' | 'user'`.
[doc]: Handbook — Inférence littérale | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Que vaut `port` ?
```ts
const config = { port: 0 };
const port = config.port || 3000;
```
- [ ] `0`
- [x] `3000`
- [ ] `undefined`
- [ ] Erreur de compilation
> `||` remplace toute valeur *falsy* (`0`, `''`, `false`, `NaN`, `null`, `undefined`). Pour ne remplacer que `null`/`undefined`, utilise `??` : `config.port ?? 3000` vaudrait `0`.
[doc]: MDN — Opérateur de coalescence des nuls (??) | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing

### Que fait l'opérateur `!` dans `document.getElementById('app')!.focus()` ?
- [ ] Il lève une erreur si l'élément est `null`
- [ ] Il convertit la valeur en booléen
- [x] Il indique au compilateur que la valeur n'est pas `null`/`undefined`, sans aucune vérification à l'exécution
- [ ] Il est équivalent à `?.`
> La *non-null assertion* est purement statique : elle disparaît à la compilation. Si l'élément est absent, on obtient un `TypeError` au runtime. À utiliser avec parcimonie, quand on a une certitude que TS ne peut pas déduire.
[doc]: Handbook — Non-null assertion | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Quel est l'intérêt principal de `satisfies` par rapport à une annotation `: Type` ?
```ts
const routes = { home: '/', user: '/user/:id' } satisfies Record<string, string>;
```
- [ ] Il effectue une validation à l'exécution
- [x] Il vérifie la conformité au type tout en conservant le type inféré (plus précis)
- [ ] Il caste la valeur comme `as`
- [ ] Il rend l'objet `readonly`
> Avec `: Record<string, string>`, `routes.home` serait `string` et `routes.inconnu` serait autorisé. Avec `satisfies`, l'objet est **validé** mais garde ses clés exactes : `routes.inconnu` est une erreur. Contrairement à `as`, `satisfies` ne ment jamais au compilateur.
[doc]: Release notes TS 4.9 — satisfies (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html

### Quelles valeurs sont assignables au type `{}` ?
- [ ] Uniquement les objets littéraux vides
- [ ] Tous les objets, mais pas les primitifs
- [x] Toute valeur sauf `null` et `undefined`, y compris `42` et `'texte'`
- [ ] Uniquement `null` et `undefined`
> `{}` signifie « n'importe quoi qui a une forme », donc tout sauf `null`/`undefined`. Pour « non primitif », c'est `object`. Pour un dictionnaire, préfère `Record<string, unknown>`.
[doc]: Handbook — Types objet | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Avec `strictNullChecks` activé, quel est le type de `user.email` ?
```ts
interface User { email?: string }
declare const user: User;
```
- [ ] `string`
- [x] `string | undefined`
- [ ] `string | null`
- [ ] `string | null | undefined`
> Une propriété optionnelle (`?`) ajoute `undefined` à son type. `null` n'est jamais ajouté automatiquement. (Avec l'option `exactOptionalPropertyTypes`, on ne pourrait même plus y affecter explicitement `undefined`.)
[doc]: Handbook — Propriétés optionnelles | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Quel est le type inféré de `valeurs` ?
```ts
const valeurs = [1, 'a', true];
```
- [ ] `[number, string, boolean]`
- [x] `(string | number | boolean)[]`
- [ ] `any[]`
- [ ] `readonly [1, 'a', true]`
> Sans annotation ni `as const`, TS infère un **tableau** dont le type d'élément est l'union des types rencontrés. Pour un tuple, il faut annoter `[number, string, boolean]` ou utiliser `as const`.
[doc]: Handbook — Tableaux et tuples | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Que renvoie `typeof null` en JavaScript ?
- [ ] `'null'`
- [x] `'object'`
- [ ] `'undefined'`
- [ ] Une erreur
> Bug historique de JavaScript, conservé pour compatibilité. C'est pourquoi un narrowing `typeof x === 'object'` ne suffit pas à exclure `null` : TS le sait et garde `object | null`.
[doc]: MDN — typeof | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/typeof

### Ce code compile-t-il ?
```ts
const callbacks: Array<() => void> = [];
callbacks.push(() => 42);
```
- [x] Oui : une fonction qui retourne une valeur est assignable à un type fonction retournant `void`
- [ ] Non : `42` n'est pas `void`
- [ ] Non : il faut `() => undefined`
- [ ] Oui, mais uniquement sans `strict`
> Un type de fonction contextuel retournant `void` signifie « la valeur de retour sera ignorée », pas « doit retourner undefined ». C'est ce qui permet `[1, 2].forEach(n => arr.push(n))` alors que `push` retourne un `number`. En revanche, une **déclaration** `function f(): void { return 42 }` est une erreur.
[doc]: Handbook — Type de retour void | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quel réglage `tsconfig` faut-il activer pour obtenir `strictNullChecks`, `noImplicitAny` et les autres contrôles stricts d'un coup ?
- [ ] `"noImplicitReturns": true`
- [x] `"strict": true`
- [ ] `"checkJs": true`
- [ ] `"isolatedModules": true`
> `strict` active une famille d'options (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, `useUnknownInCatchVariables`…). C'est le minimum attendu sur un projet professionnel.
[doc]: Référence tsconfig — strict | https://www.typescriptlang.org/fr/tsconfig#strict

### Quel est le type de `e` dans `catch (e)` avec `strict: true` (TS ≥ 4.4) ?
- [ ] `Error`
- [ ] `any`
- [x] `unknown`
- [ ] `never`
> L'option `useUnknownInCatchVariables` (incluse dans `strict`) type la variable de `catch` en `unknown`, car JavaScript permet de lever n'importe quoi (`throw 'oops'`). Il faut donc vérifier `e instanceof Error` avant d'accéder à `e.message`.
[doc]: Référence tsconfig — useUnknownInCatchVariables | https://www.typescriptlang.org/fr/tsconfig#useUnknownInCatchVariables

### Ce code compile-t-il ?
```ts
const log: () => void = () => 42;
```
- [x] Oui : un type fonction qui retourne `void` accepte une fonction qui retourne une valeur, celle-ci sera ignorée
- [ ] Non : `42` n'est pas assignable à `void`
- [ ] Oui, et `log()` est de type `number`
- [ ] Non, il faut écrire `() => undefined`
> Pour un **type fonction** contextuel `() => void`, TS autorise une implémentation qui retourne quelque chose : c'est ce qui permet `arr.forEach((x) => list.push(x))` alors que `push` retourne un nombre. En revanche, une déclaration `function f(): void { return 42; }` est refusée. Et `log()` reste typé `void`.
[doc]: Handbook — Retour de type void | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Ce code compile-t-il ?
```ts
const pair: [string, number] = ['a', 1];
pair.push(2);
```
- [x] Oui : `push` reste disponible sur un tuple et accepte `string | number`
- [ ] Non : un tuple a une longueur fixe
- [ ] Non : `push` n'existe pas sur un tuple
- [ ] Oui, mais `pair` devient `[string, number, number]`
> C'est un trou connu du système de types : un tuple est un tableau, et ses méthodes mutantes restent accessibles. Pour verrouiller la longueur, utilisez `readonly [string, number]` (ou `as const`), qui retire `push`, `pop`, `splice`…
[doc]: Handbook — Tuples | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Que se passe-t-il ici ?
```ts
function afficher(ids: readonly number[]) {
  ids.push(4);
}
```
- [ ] Ça compile, `readonly` ne concerne que la réassignation de `ids`
- [x] Erreur : `push` n'existe pas sur `readonly number[]`
- [ ] Erreur à l'exécution : le tableau est gelé
- [ ] Ça compile, mais lève un warning
> `readonly number[]` (ou `ReadonlyArray<number>`) retire les méthodes mutantes du **type**. Rien n'est gelé à l'exécution (`Object.freeze` le ferait). Annoter les paramètres en `readonly` documente que la fonction ne modifie pas ce qu'on lui passe, et accepte aussi bien un tableau mutable qu'immuable.
[doc]: Handbook — ReadonlyArray | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Quel est le type de `config.mode` ?
```ts
const config = { mode: 'dark' };
```
- [ ] `'dark'`
- [x] `string`
- [ ] `readonly 'dark'`
- [ ] `any`
> `const` empêche de réassigner `config`, pas de modifier ses propriétés : TS élargit donc `mode` en `string`. Pour garder le littéral : `{ mode: 'dark' } as const` ou une annotation `{ mode: 'dark' | 'light' }`. C'est une source fréquente d'erreurs « string n'est pas assignable à 'dark' | 'light' ».
[doc]: Handbook — Inférence littérale | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Pourquoi l'appel `deplacer(direction)` ne compile-t-il pas ?
```ts
function deplacer(d: 'gauche' | 'droite') {}
let direction = 'gauche';
deplacer(direction);
```
- [ ] Parce que `direction` peut être `undefined`
- [x] Parce que `let` élargit le type de `direction` en `string`
- [ ] Parce qu'il faut écrire `deplacer(<'gauche'>direction)`
- [ ] Il compile sans erreur
> Avec `let`, la variable peut changer : TS infère `string`, qui n'est pas assignable à l'union de littéraux. Solutions : `const direction = 'gauche'`, ou annoter `let direction: 'gauche' | 'droite' = 'gauche'`.
[doc]: Handbook — Types littéraux | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Que répond le compilateur à `const n = 'hello' as number;` ?
- [ ] Rien, `as` force toujours le type
- [x] Une erreur : la conversion de `string` vers `number` est probablement une erreur
- [ ] Il convertit la chaîne en nombre à l'exécution
- [ ] Il infère `NaN`
> Une assertion `as` n'est acceptée que si l'un des deux types est assignable à l'autre. Sinon il faut passer explicitement par `as unknown as number` — ce qui doit alerter en revue de code. Et `as` ne fait **aucune conversion** à l'exécution.
[doc]: Handbook — Type assertions | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Quel est le type de `ville` ?
```ts
interface User { address?: { city: string } }
declare const user: User | undefined;
const ville = user?.address?.city;
```
- [ ] `string`
- [x] `string | undefined`
- [ ] `string | null | undefined`
- [ ] `unknown`
> Le chaînage optionnel `?.` court-circuite et produit `undefined` dès qu'un maillon est `null` ou `undefined`. Le type résultant ajoute donc `undefined` (et jamais `null`). On le combine souvent avec `??` pour fournir une valeur par défaut.
[doc]: MDN — Chaînage optionnel | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Optional_chaining

### Quelles valeurs sont assignables au type `object` (minuscule) ? (plusieurs réponses)
- [x] `{ a: 1 }`
- [x] `[1, 2, 3]`
- [x] `() => {}`
- [ ] `'texte'`
- [ ] `null`
> `object` désigne toute valeur **non primitive** : objets, tableaux, fonctions. Il exclut `string`, `number`, `boolean`, `bigint`, `symbol`, `null` et `undefined`. À ne pas confondre avec `{}` (tout sauf `null`/`undefined`) ni avec `Object` (à éviter).
[doc]: Handbook — object | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html
