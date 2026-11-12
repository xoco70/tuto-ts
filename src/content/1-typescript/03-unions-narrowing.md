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

### Quel opérateur affine `Fish | Bird` selon la présence d'une méthode `swim` ?
- [ ] `typeof pet === 'Fish'`
- [x] `'swim' in pet`
- [ ] `pet instanceof Fish` quand `Fish` est une interface
- [ ] `pet.swim?`
> L'opérateur `in` teste la présence d'une clé et TS affine l'union en conséquence. `typeof` ne retourne que des types JS (`'object'`, `'string'`…).
[doc]: Handbook — Narrowing avec in | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

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
