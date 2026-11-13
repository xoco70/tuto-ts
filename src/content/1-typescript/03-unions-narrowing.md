---
id: ts-narrowing
track: typescript
order: 3
title: Unions, narrowing et unions discriminées
level: Intermédiaire
summary: Affiner les types (typeof, in, instanceof, type guards, assertion functions) et modéliser des états avec des unions discriminées.
---

## Unions

```ts
type Id = string | number;
function afficher(id: Id) {
  id.toUpperCase();          // ❌ n'existe pas sur number
}
```
Sur une union, on ne peut utiliser que ce qui est **commun à tous les membres**. Pour aller plus loin, il faut **affiner** (*narrowing*).

## Les outils de narrowing

```ts
function f(x: string | number | Date | null | { kind: 'a' }) {
  if (typeof x === 'string') {}       // string
  if (x instanceof Date) {}           // Date (classes uniquement)
  if (x === null) {}                  // null
  if (x && 'kind' in x) {}            // { kind: 'a' }
  if (Array.isArray(x)) {}            // tableaux
}
```

TS fait de l'**analyse de flux de contrôle** : après un `return` ou un `throw`, le type est affiné pour la suite.

```ts
function longueur(s: string | null) {
  if (!s) return 0;     // attention : exclut aussi ''
  return s.length;      // s: string
}
```

## Type guards personnalisés

```ts
interface Chat { miauler(): void }
interface Chien { aboyer(): void }

function estChat(a: Chat | Chien): a is Chat {
  return 'miauler' in a;
}
```

`a is Chat` est un **prédicat de type** : si la fonction renvoie `true`, TS considère `a` comme `Chat`. Le compilateur **fait confiance** à ton implémentation : un prédicat faux = un mensonge silencieux.

Depuis TS 5.5, TS **infère** les prédicats pour des fonctions simples : `arr.filter(x => x !== null)` retourne enfin `T[]` au lieu de `(T | null)[]`.

### Assertion functions

```ts
function assertDefini<T>(v: T, msg: string): asserts v is NonNullable<T> {
  if (v == null) throw new Error(msg);
}
assertDefini(user, 'user manquant');
user.nom; // user n'est plus null ici
```

## Unions discriminées

Le pattern le plus utile de TypeScript : chaque membre porte une propriété littérale commune (le **discriminant**).

```ts
type Etat =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: Error };

function rendu(e: Etat) {
  switch (e.status) {
    case 'success': return e.data.length;   // data accessible
    case 'error':   return e.error.message;
    default:        return 0;
  }
}
```

Avantage : impossible d'avoir `data` **et** `error` en même temps, ou `data` pendant `loading` (*make illegal states unrepresentable*).

## Vérification d'exhaustivité

```ts
function assertNever(x: never): never {
  throw new Error(`Cas non géré : ${JSON.stringify(x)}`);
}

switch (e.status) {
  case 'idle': ...
  case 'loading': ...
  case 'success': ...
  case 'error': ...
  default: return assertNever(e);   // ❌ compile si on ajoute un statut sans le gérer
}
```

Si quelqu'un ajoute `{ status: 'cancelled' }`, le `default` reçoit ce membre au lieu de `never` → **erreur de compilation**. C'est un argument fort en entretien.

## Narrowing et pièges

- Le narrowing ne survit pas toujours dans les callbacks : TS ne sait pas si une variable `let` a été modifiée entre-temps. Copie dans une `const` si besoin.
- `typeof x === 'object'` laisse passer `null`.
- `in` affine sur la présence d'une clé, `instanceof` ne marche qu'avec des **classes** (pas des interfaces).
- `==  null` teste à la fois `null` et `undefined` (seul cas où `==` est idiomatique).

<!-- QUIZ -->

### Pourquoi `afficher` ne compile-t-elle pas ?
```ts
function afficher(id: string | number) {
  return id.toUpperCase();
}
```
- [ ] `toUpperCase` n'existe pas en TypeScript
- [x] `toUpperCase` n'existe pas sur `number`, l'un des membres de l'union
- [ ] Il faut annoter le type de retour
- [ ] Une union ne peut pas servir de type de paramètre
> Sur une union, on ne peut utiliser que ce qui existe sur **tous** les membres. Pour appeler une méthode de `string`, il faut d'abord **affiner** : `if (typeof id === 'string') return id.toUpperCase();`.
[doc]: Handbook — Narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quelles méthodes peut-on appeler sur `id: string | number` sans aucun narrowing ? (plusieurs réponses)
- [x] `id.toString()`
- [x] `id.valueOf()`
- [ ] `id.toFixed(2)`
- [ ] `id.trim()`
> `toString` et `valueOf` existent à la fois sur `string` et sur `number` : elles sont donc disponibles sur l'union. `toFixed` n'existe que sur `number`, `trim` que sur `string` : il faut affiner avant de les appeler.
[doc]: Handbook — Narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `x` dans le `else` ?
```ts
function f(x: string | number) {
  if (typeof x === 'string') {
    return x.length;
  } else {
    x;
  }
}
```
- [ ] `string | number`
- [x] `number`
- [ ] `never`
- [ ] `unknown`
> Le `typeof` affine dans les **deux** branches : `string` dans le `if`, et ce qui reste de l'union, `number`, dans le `else`. C'est l'analyse de flux de contrôle.
[doc]: Handbook — Narrowing avec typeof | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `d` dans le bloc `if` ?
```ts
function formater(d: Date | string) {
  if (d instanceof Date) {
    d;
  }
}
```
- [x] `Date`
- [ ] `Date | string`
- [ ] `object`
- [ ] `string`
> `instanceof` teste la chaîne de prototypes à l'exécution, et TS affine en conséquence. Ça marche ici parce que `Date` est une **classe**, qui existe au runtime ; avec une interface, ce serait impossible.
[doc]: Handbook — Narrowing avec instanceof | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `nom` dans le bloc `if` ?
```ts
function saluer(nom: string | null) {
  if (nom !== null) {
    nom;
  }
}
```
- [ ] `string | null`
- [x] `string`
- [ ] `null`
- [ ] `never`
> Une comparaison stricte avec `null` retire `null` de l'union. Contrairement à `if (nom)`, elle conserve la chaîne vide `''`, qui est un `string` légitime.
[doc]: Handbook — Narrowing par égalité | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `u` dans le bloc `if` ?
```ts
interface User { nom: string }
function f(u: User | undefined) {
  if (u) {
    u;
  }
}
```
- [x] `User`
- [ ] `User | undefined`
- [ ] `object`
- [ ] `true`
> Un objet est toujours *truthy* et `undefined` toujours *falsy* : `if (u)` élimine donc `undefined`. Pour un objet, ce test est sans piège ; il l'est pour un `number` ou une `string`, où `0` et `''` seraient aussi exclus.
[doc]: Handbook — Truthiness narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Dans le `case 'success'`, quelles propriétés de `e` sont accessibles ?
```ts
type Etat =
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: Error };

function rendu(e: Etat) {
  switch (e.status) {
    case 'success':
      e; // ici
  }
}
```
- [ ] Seulement `status`
- [x] `status` et `data`
- [ ] `status`, `data` et `error`
- [ ] Aucune : il faut un `as`
> En testant le discriminant `status`, TS sait qu'on est dans le membre `{ status: 'success'; data: string[] }` : `e.data` devient accessible, `e.error` non. C'est tout l'intérêt d'une union discriminée.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Pourquoi `f.r` est-il refusé ?
```ts
type Forme = { kind: 'cercle'; r: number } | { kind: 'carre'; c: number };
function rayon(f: Forme) {
  return f.r;
}
```
- [ ] `r` est mal typé dans `Forme`
- [x] `f` peut être un carré, qui n'a pas de propriété `r` : il faut d'abord tester `f.kind === 'cercle'`
- [ ] Il suffit d'écrire `f?.r`
- [ ] On ne peut jamais lire une propriété sur une union
> Tant que l'union n'est pas affinée, seules les propriétés communes (ici `kind`) sont lisibles. Un test sur le discriminant (`if (f.kind === 'cercle')`) donne accès à `r`. `?.` ne change rien : il protège de `null`/`undefined`, pas d'une propriété absente du type.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quelle signature déclare un *type guard* pour `Chat` ?
- [ ] `function estChat(a: Chat | Chien): boolean`
- [x] `function estChat(a: Chat | Chien): a is Chat`
- [ ] `function estChat(a: Chat | Chien): Chat`
- [ ] `function estChat(a: Chat | Chien): a as Chat`
> Le type de retour `a is Chat` est un **prédicat de type** : la fonction renvoie un `boolean`, mais quand elle renvoie `true`, TS affine `a` en `Chat` chez l'appelant. Annotée `: boolean`, elle donnerait le bon résultat à l'exécution mais n'affinerait rien.
[doc]: Handbook — Type predicates | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Laquelle de ces unions est une union discriminée ?
- [x] `{ type: 'a'; x: number } | { type: 'b'; y: string }`
- [ ] `{ x: number } | { y: string }`
- [ ] `{ type: string; x: number } | { type: string; y: string }`
- [ ] `string | number`
> Il faut une propriété commune (`type`) dont le type est un **littéral différent** dans chaque membre. Avec `type: string`, tester `u.type === 'a'` ne permet pas à TS de savoir de quel membre il s'agit.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `x` dans le bloc `if` ?
```ts
function f(x: string | number | boolean) {
  if (typeof x === 'string' || typeof x === 'number') {
    x;
  }
}
```
- [ ] `string`
- [x] `string | number`
- [ ] `boolean`
- [ ] `string | number | boolean`
> L'analyse de flux combine les deux gardes avec `||` : dans le bloc, `x` est `string | number`. Dans le `else`, il serait `boolean`.
[doc]: Handbook — Narrowing avec typeof | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Pourquoi ce code ne compile-t-il pas ?
```ts
interface Admin { droits: string[] }
function f(u: unknown) {
  if (u instanceof Admin) {}
}
```
- [ ] `instanceof` ne fonctionne pas avec `unknown`
- [x] `Admin` est une interface : elle n'existe pas à l'exécution, `instanceof` exige une valeur (une classe)
- [ ] Il faut écrire `u instanceof <Admin>`
- [ ] Il manque `as Admin`
> `instanceof` est un opérateur JavaScript qui compare la chaîne de prototypes à un constructeur. Une interface est effacée : il faut un **type guard** (`'droits' in u`) ou une **classe**.
[doc]: Handbook — Narrowing avec instanceof | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Que signifie le type de retour `pet is Fish` ?
```ts
function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined;
}
```
- [ ] La fonction retourne un `Fish`
- [x] C'est un prédicat de type : si elle retourne `true`, l'argument est considéré comme `Fish` par l'appelant
- [ ] La fonction lève une erreur si ce n'est pas un `Fish`
- [ ] C'est une vérification faite à l'exécution par TypeScript
> Un *type predicate* retourne un `boolean` mais informe le compilateur. Attention : TS ne vérifie pas que ton implémentation est correcte — un prédicat buggé ment au compilateur.
[doc]: Handbook — Type predicates | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Qu'apporte une signature `asserts value is string` ?
```ts
function assertString(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new TypeError();
}
```
- [ ] La fonction retourne `true` ou `false`
- [x] Après l'appel, `value` est considéré comme `string` dans le reste du scope (sinon la fonction a levé)
- [ ] La vérification n'a lieu qu'en mode développement
- [ ] Elle convertit `value` en chaîne
> Une *assertion function* ne retourne rien : si elle termine sans lever, le compilateur affine le type pour la suite du flux. Très pratique pour les invariants (`assertDefined`, `assert(cond)`).
[doc]: Release notes TS 3.7 — Assertion functions (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions

### Dans une union discriminée, qu'est-ce que le « discriminant » ?
- [ ] Une méthode commune à tous les membres
- [x] Une propriété présente dans chaque membre, avec un type littéral différent
- [ ] Le premier membre de l'union
- [ ] Un champ optionnel
> Par exemple `status: 'loading' | 'success' | 'error'`. En testant `e.status === 'success'`, TS sait exactement quel membre on manipule et donne accès à ses propriétés spécifiques.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le rôle de `assertNever(x)` dans le `default` d'un `switch` ?
```ts
function assertNever(x: never): never { throw new Error(); }
```
- [ ] Empêcher l'exécution du `default` à l'exécution
- [x] Provoquer une erreur de compilation si un membre de l'union n'est pas traité par un `case`
- [ ] Rendre le `switch` plus performant
- [ ] Transformer l'union en `never`
> Si tous les cas sont couverts, `x` est `never` dans le `default` et l'appel compile. Si un nouveau membre est ajouté à l'union sans `case`, `x` a ce type → il n'est pas assignable à `never` → erreur. C'est la **vérification d'exhaustivité**.
[doc]: Handbook — Exhaustiveness checking | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Quelle modélisation empêche d'avoir à la fois `data` et `error` ?
- [ ] `{ loading: boolean; data?: User[]; error?: Error }`
- [x] `{ status: 'success'; data: User[] } | { status: 'error'; error: Error } | { status: 'loading' }`
- [ ] `{ status: string; data: User[] | null; error: Error | null }`
- [ ] `Partial<{ data: User[]; error: Error }>`
> Avec des champs optionnels, les combinaisons incohérentes (`loading: true` + `error` + `data`) sont représentables. L'union discriminée rend les **états illégaux non représentables**.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `x` dans le bloc ?
```ts
function f(x: string[] | null) {
  if (typeof x === 'object') {
    x;
  }
}
```
- [ ] `string[]`
- [x] `string[] | null`
- [ ] `null`
- [ ] `object`
> `typeof null === 'object'` en JavaScript : TS le sait et conserve `null`. Il faut ajouter `x !== null` ou utiliser `if (x)`.
[doc]: Handbook — typeof et null | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Que teste `if (value == null)` ?
- [ ] Uniquement `null`
- [x] `null` ou `undefined`
- [ ] Toute valeur falsy
- [ ] C'est une erreur en TypeScript
> `== null` est le seul usage idiomatique de l'égalité faible : vrai pour `null` et `undefined`, faux pour `0`, `''` et `false`. TS affine correctement dans les deux branches.
[doc]: Handbook — Narrowing par égalité | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel est le type de `nom` après le `if` ?
```ts
function f(nom: string | undefined) {
  if (!nom) {
    throw new Error('requis');
  }
  nom;
}
```
- [ ] `string | undefined`
- [x] `string`
- [ ] `never`
- [ ] `undefined`
> L'analyse de flux de contrôle sait qu'après un `throw` (ou `return`), la suite n'est atteinte que si la condition était fausse. Notez que `!nom` rejette aussi la chaîne vide `''`, ce qui peut être voulu… ou un bug.
[doc]: Handbook — Control flow analysis | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Quel opérateur affine `Fish | Bird` selon la présence d'une méthode `swim` ?
- [ ] `typeof pet === 'Fish'`
- [x] `'swim' in pet`
- [ ] `pet instanceof Fish` quand `Fish` est une interface
- [ ] `pet.swim?`
> L'opérateur `in` teste la présence d'une clé et TS affine l'union en conséquence. `typeof` ne retourne que des types JS (`'object'`, `'string'`…).
[doc]: Handbook — Narrowing avec in | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Depuis TS 5.5, quel est le type de `res` ?
```ts
const res = [1, null, 2].filter((x) => x !== null);
```
- [ ] `(number | null)[]`
- [x] `number[]`
- [ ] `any[]`
- [ ] `never[]`
> TS 5.5 **infère les prédicats de type** pour les fonctions simples : `x => x !== null` devient `(x) => x is number`. Avant, il fallait écrire le prédicat à la main ou utiliser un helper.
[doc]: Release notes TS 5.5 — Inferred type predicates (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html
[niveau]: avancé

### Pourquoi TS peut-il « perdre » un narrowing à l'intérieur d'un callback ?
```ts
let user: User | null = getUser();
if (user) {
  setTimeout(() => user.nom); // erreur possible
}
```
- [ ] Les callbacks sont toujours typés `any`
- [x] `user` est une variable `let` qui pourrait être réassignée avant l'exécution du callback
- [ ] `setTimeout` efface les types
- [ ] C'est un bug de TypeScript
> Le callback s'exécute plus tard ; entre-temps, `user` pourrait valoir `null`. Avec une `const` (ou une copie `const u = user`), le narrowing est conservé. TS 5.4 a amélioré le cas des variables non réassignées après la closure.
[doc]: Handbook — Control flow analysis | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: avancé

### Parmi ces expressions, lesquelles affinent effectivement un type union ? (plusieurs réponses)
- [x] `Array.isArray(x)`
- [x] `x instanceof Error`
- [ ] `x as string`
- [x] `typeof x === 'function'`
> `as` est une **assertion** : elle ne vérifie rien, elle force le type. Les trois autres sont des gardes réelles évaluées à l'exécution que le compilateur sait interpréter.
[doc]: Handbook — Narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Ce code compile-t-il ?
```ts
type Forme = { kind: 'cercle'; r: number } | { kind: 'carre'; c: number };
function aire(f: Forme) {
  if (f.kind === 'cercle') return Math.PI * f.r ** 2;
  return f.c ** 2;
}
```
- [x] Oui : après le `return`, `f` est affiné en `{ kind: 'carre' }`
- [ ] Non : `f.c` n'existe pas sur `Forme`
- [ ] Non : il faut un `switch`
- [ ] Oui, mais `f.c` est `any`
> L'analyse de flux exclut le membre `cercle` après le `return` : il ne reste que `carre`. Pas besoin de `else` ni de `switch`.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Quel est le type de `x` dans le bloc `if` ?
```ts
function f(x: string[] | string | null) {
  if (typeof x === 'object') {
    x;
  }
}
```
- [ ] `string[]`
- [x] `string[] | null`
- [ ] `object`
- [ ] `never`
> Piège classique : `typeof null === 'object'`. Le narrowing conserve donc `null`. Il faut ajouter `x !== null` (ou tester `if (x && typeof x === 'object')`) pour obtenir `string[]`.
[doc]: Handbook — typeof type guards | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Quel est le bug de cette fonction ?
```ts
function afficher(nb: number | undefined) {
  if (nb) {
    return `${nb} articles`;
  }
  return 'Panier non chargé';
}
```
- [ ] Aucun
- [x] Pour `nb = 0`, elle affiche « Panier non chargé »
- [ ] Elle ne compile pas car `nb` peut être `undefined`
- [ ] `nb` est de type `number | undefined` dans le `if`
> Le narrowing par « truthiness » exclut aussi `0`, `''` et `NaN`. Quand `0` est une valeur légitime, testez explicitement `nb !== undefined` (ou `nb != null`).
[doc]: Handbook — Truthiness narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Quel est le type de `x` dans le bloc `if` ?
```ts
function f(x: string | number, y: string | boolean) {
  if (x === y) {
    x;
  }
}
```
- [ ] `string | number`
- [x] `string`
- [ ] `never`
- [ ] `string | number | boolean`
> Le narrowing par **égalité** : si `x === y`, les deux ont forcément le même type, donc le seul type commun, `string`. TS affine `x` et `y` en `string` dans le bloc.
[doc]: Handbook — Equality narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: avancé

### Que se passe-t-il à la dernière ligne ?
```ts
let x = Math.random() < 0.5 ? 10 : 'bonjour';
x = 1;
x = true;
```
- [ ] Rien, `x` est de type `number` après `x = 1`
- [x] Erreur : `boolean` n'est pas assignable à `string | number`
- [ ] `x` devient `string | number | boolean`
- [ ] Erreur à la ligne `x = 1`
> Après `x = 1`, TS **affine** `x` en `number` pour la suite du flux, mais le **type déclaré** (ici inféré `string | number`) reste la référence pour les affectations. On peut donc réaffecter une chaîne, pas un booléen.
[doc]: Handbook — Assignments | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: avancé

### Depuis TS 4.9, quel est le type de `value` dans le bloc ?
```ts
function f(value: unknown) {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    value;
  }
}
```
- [ ] `unknown`
- [ ] `{ id: any }`
- [x] `object & Record<'id', unknown>`
- [ ] `never`
> Depuis TS 4.9, l'opérateur `in` appliqué à une clé absente du type **ajoute** la propriété avec le type `unknown`. On peut donc lire `value.id` (de type `unknown`) et continuer à l'affiner. Pour des données réellement externes, un schéma Zod reste plus lisible.
[doc]: TypeScript 4.9 — narrowing avec in | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
[niveau]: avancé

### Ce code compile-t-il ?
```ts
interface User { address?: { city: string } }
function ville(user: User | undefined) {
  if (user?.address) {
    return user.address.city;
  }
}
```
- [x] Oui : si `user?.address` est truthy, TS sait que `user` et `user.address` sont définis
- [ ] Non : `user` peut être `undefined` dans le bloc
- [ ] Non : il faut écrire `user!.address!.city`
- [ ] Oui, mais seulement avec `strict: false`
> Le contrôle de flux comprend le chaînage optionnel : un résultat truthy implique que chaque maillon intermédiaire existe. Inutile d'empiler les `!`.
[doc]: Handbook — Narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Quel est le type de `x` dans le bloc ?
```ts
function f(x: string | string[]) {
  if (Array.isArray(x)) {
    x;
  }
}
```
- [ ] `string | string[]`
- [x] `string[]`
- [ ] `any[]`
- [ ] `object`
> `Array.isArray` est déclaré comme type guard (`arg is any[]`), TS l'utilise pour affiner l'union. À noter : `typeof x === 'object'` n'aurait pas permis de distinguer un tableau d'un autre objet.
[doc]: Handbook — Narrowing | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html
[niveau]: facile

### Depuis TS 5.3, ce code compile-t-il ?
```ts
function f(x: string | number) {
  switch (true) {
    case typeof x === 'string':
      return x.toUpperCase();
    default:
      return x.toFixed(2);
  }
}
```
- [x] Oui : TS affine `x` dans chaque `case` d'un `switch (true)`
- [ ] Non : `x` reste `string | number` dans les `case`
- [ ] Non : `switch (true)` est interdit en TypeScript
- [ ] Oui, mais seulement le premier `case` est affiné
> TS 5.3 a ajouté le narrowing dans `switch (true)` : chaque condition de `case` affine le type, et le `default` reçoit ce qui reste. Pratique pour remplacer une longue chaîne de `if / else if`.
[doc]: TypeScript 5.3 — switch (true) narrowing | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html
[niveau]: avancé
