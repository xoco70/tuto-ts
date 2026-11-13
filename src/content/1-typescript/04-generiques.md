---
id: ts-generiques
track: typescript
order: 4
title: Les génériques
level: Intermédiaire
summary: Paramètres de type, contraintes, valeurs par défaut, inférence, variance et génériques dans les classes.
---

## Pourquoi des génériques ?

```ts
function premierAny(arr: any[]): any { return arr[0]; }        // perd le type
function premier<T>(arr: T[]): T | undefined { return arr[0]; } // le conserve

const n = premier([1, 2, 3]);   // number | undefined (T inféré = number)
const s = premier<string>([]);  // T explicite
```

Un générique est une **fonction au niveau des types** : `T` est un paramètre que l'appelant (ou l'inférence) fixe.

## Contraintes avec `extends`

```ts
function longueur<T extends { length: number }>(x: T): number {
  return x.length;
}
longueur('abc');   // ✅
longueur([1, 2]);  // ✅
longueur(42);      // ❌ number n'a pas de length

function lire<T, K extends keyof T>(obj: T, cle: K): T[K] {
  return obj[cle];
}
lire({ nom: 'Ada', age: 36 }, 'age');  // number
lire({ nom: 'Ada' }, 'email');          // ❌
```

`K extends keyof T` + `T[K]` (*indexed access type*) est le duo le plus courant en entretien.

## Valeurs par défaut et plusieurs paramètres

```ts
interface ApiResponse<T = unknown, E = Error> {
  data?: T;
  error?: E;
}
type R = ApiResponse;           // ApiResponse<unknown, Error>
```

## Génériques dans les classes et interfaces

```ts
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private items = new Map<string, T>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async save(entity: T) { this.items.set(entity.id, entity); return entity; }
}
```

Les **membres statiques** d'une classe ne peuvent pas utiliser le paramètre de type de la classe (ils sont partagés par toutes les instanciations).

## Inférence et bonnes pratiques

- **Laisse l'inférence travailler** : ne passe `<T>` explicitement que si nécessaire.
- **Un paramètre de type doit apparaître au moins deux fois** (entrée/sortie). Sinon il est inutile : `function f<T>(x: T): void` → écris `x: unknown`.
- Préférer `T[]` à `T extends any[]` quand c'est possible : TS infère mieux.
- `const` type parameters (TS 5.0) : `function f<const T>(x: T)` infère comme si l'appelant avait écrit `as const`.

```ts
function routes<const T extends readonly string[]>(r: T) { return r; }
const r = routes(['/', '/users']);  // readonly ['/', '/users']
```

## Variance (niveau senior)

- **Covariance** : si `Chien` ⊂ `Animal`, alors `Chien[]` est assignable à `Animal[]` (lecture).
- **Contravariance** : les **paramètres** de fonctions vont dans l'autre sens. Une fonction `(a: Animal) => void` est assignable à `(c: Chien) => void`, pas l'inverse (avec `strictFunctionTypes`).
- Les **méthodes** (`m(x: T): void` dans une interface) restent **bivariantes** pour raisons historiques — les propriétés fonction (`m: (x: T) => void`) sont vérifiées strictement.

TS 4.7 permet d'annoter : `interface Producteur<out T>`, `interface Consommateur<in T>`.

## Génériques utiles à connaître

```ts
Promise<T>            Array<T>           Map<K, V>         Set<T>
Record<K, V>          Partial<T>         ReturnType<F>     Awaited<T>
```

## S'entraîner

- [TypeScript Exercises](https://typescript-exercises.github.io/) : 16 exercices progressifs à faire dans le navigateur. On part d'interfaces simples, on passe par les unions, le narrowing et les génériques, jusqu'aux fichiers de déclaration et à l'augmentation de modules.
- [Type Challenges](https://github.com/type-challenges/type-challenges) : des exercices de typage avec tests intégrés, à résoudre dans le Playground (énoncés en anglais). Pour s'exercer aux contraintes génériques sur les tuples (`T extends readonly unknown[]`) :
  - [Hello World](https://tsch.js.org/13) (échauffement)
  - [Length of Tuple](https://tsch.js.org/18)
  - [Concat](https://tsch.js.org/533)
  - [Push](https://tsch.js.org/3057)
  - [Unshift](https://tsch.js.org/3060)

<!-- QUIZ -->

### Dans `function identite<T>(x: T): T`, que représente `T` ?
- [ ] Un type prédéfini de TypeScript, comme `string`
- [x] Un paramètre de type, fixé par l'appelant ou déduit de l'argument
- [ ] Une variable JavaScript disponible à l'exécution
- [ ] Un alias de `any`
> `T` est une sorte de variable **au niveau des types** : à chaque appel, il prend une valeur précise (`number`, `User`…), soit par inférence depuis l'argument, soit explicitement (`identite<number>(…)`). Comme tous les types, il disparaît à la compilation.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de `r` ?
```ts
function identite<T>(x: T): T { return x; }
const r = identite([1, 2, 3]);
```
- [ ] `any`
- [ ] `unknown`
- [x] `number[]`
- [ ] `T[]`
> TS infère `T = number[]` à partir de l'argument, et le type de retour suit : c'est tout l'intérêt d'un générique par rapport à `any`, qui aurait perdu l'information. Tu n'as rien eu à écrire entre chevrons.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Comment fixer explicitement `T` à `string` lors de l'appel de `premier` ?
```ts
function premier<T>(arr: T[]): T | undefined { return arr[0]; }
```
- [x] `premier<string>([])`
- [ ] `premier([]) as string`
- [ ] `premier(<string>[])`
- [ ] `premier[string]([])`
> On passe l'argument de type entre chevrons, juste après le nom de la fonction. C'est utile quand il n'y a rien à inférer (ici un tableau vide). Le reste du temps, laisse l'inférence travailler.
[doc]: Handbook — Generic types | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quelle déclaration compile ?
```ts
interface Boite<T> { contenu: T }
```
- [x] `const b: Boite<number> = { contenu: 1 };`
- [ ] `const b: Boite = { contenu: 1 };`
- [ ] `const b: Boite<number> = { contenu: 'un' };`
- [ ] `const b: Boite[number] = { contenu: 1 };`
> Une interface générique s'utilise avec son argument de type entre chevrons : `Boite<number>`. Sans valeur par défaut, `Boite` seul est refusé (« Generic type 'Boite' requires 1 type argument »), et `contenu` doit bien être un `number`.
[doc]: Handbook — Generic types | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel appel compile ?
```ts
function afficherId<T extends { id: number }>(x: T) {
  return x.id;
}
```
- [x] `afficherId({ id: 1, nom: 'Ada' })`
- [ ] `afficherId({ nom: 'Ada' })`
- [ ] `afficherId({ id: '1' })`
- [ ] `afficherId(1)`
> La contrainte `extends { id: number }` exige au minimum une propriété `id` numérique. Les propriétés en plus sont acceptées (typage structurel), et `T` garde le type exact de l'argument.
[doc]: Handbook — Generic constraints | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Dans cette classe, pourquoi peut-on écrire `entity.id` ?
```ts
class InMemoryRepository<T extends { id: string }> {
  private items = new Map<string, T>();
  save(entity: T) {
    this.items.set(entity.id, entity);
  }
}
```
- [ ] Parce que tous les objets ont un `id` en TypeScript
- [x] Grâce à la contrainte `T extends { id: string }`, qui garantit la présence de `id`
- [ ] Parce que `Map` ajoute un `id` à ses valeurs
- [ ] Ça ne compile pas : `T` est inconnu
> Sans contrainte, `T` peut être n'importe quoi et `entity.id` serait refusé. La contrainte dit « tout `T`, pourvu qu'il ait un `id: string` » : on peut donc l'utiliser dans le corps de la classe.
[doc]: Handbook — Generic classes | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### À quel type équivaut `Array<string>` ?
- [x] `string[]`
- [ ] `[string]`
- [ ] `readonly string[]`
- [ ] `string | string[]`
> `Array<T>` est l'interface générique des tableaux, et `T[]` en est le raccourci : les deux écritures sont strictement identiques. `[string]` désigne un tuple d'un seul élément.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de `tags` ?
```ts
const tags = new Set(['ts', 'node']);
```
- [x] `Set<string>`
- [ ] `Set<any>`
- [ ] `Set<'ts' | 'node'>`
- [ ] `string[]`
> `Set<T>` est une classe générique : `T` est inféré depuis le tableau passé au constructeur. Sans argument (`new Set()`), il n'y aurait rien à inférer : il faudrait alors écrire `new Set<string>()`.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de `p` ?
```ts
function paire<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}
const p = paire('x', 1);
```
- [ ] `[A, B]`
- [x] `[string, number]`
- [ ] `(string | number)[]`
- [ ] `[unknown, unknown]`
> Une fonction peut déclarer plusieurs paramètres de type, chacun inféré depuis son argument : `A = string`, `B = number`. Le retour `[A, B]` devient le tuple `[string, number]`.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Où peut-on déclarer un paramètre de type comme `<T>` ? (plusieurs réponses)
- [x] Sur une fonction : `function f<T>(x: T) {}`
- [x] Sur une interface : `interface Boite<T> {}`
- [x] Sur une classe : `class Pile<T> {}`
- [x] Sur un alias : `type Liste<T> = T[]`
- [ ] Sur un enum : `enum Statut<T> {}`
> Fonctions, interfaces, classes et alias de type peuvent tous être génériques. Les enums, eux, ne le peuvent pas : ils produisent un objet JavaScript aux valeurs fixes.
[doc]: Handbook — Generic types | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de `x` ?
```ts
function premier<T>(arr: T[]): T | undefined { return arr[0]; }
const x = premier(['a', 'b']);
```
- [ ] `string[]`
- [x] `string | undefined`
- [ ] `any`
- [ ] `T`
> `T` est inféré à partir de l'argument (`string[]` → `T = string`), donc le retour est `string | undefined`. Avec `noUncheckedIndexedAccess`, `arr[0]` serait d'ailleurs déjà typé `T | undefined`.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel appel provoque une erreur de compilation ?
```ts
function longueur<T extends { length: number }>(x: T) { return x.length; }
```
- [ ] `longueur('abc')`
- [ ] `longueur([1, 2, 3])`
- [x] `longueur(123)`
- [ ] `longueur({ length: 0 })`
> La contrainte `extends { length: number }` exige une propriété `length`. Les chaînes, tableaux et tout objet avec `length` conviennent (typage structurel) ; `number` non.
[doc]: Handbook — Generic constraints | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de retour de `lire(user, 'age')` ?
```ts
function lire<T, K extends keyof T>(obj: T, cle: K): T[K] { return obj[cle]; }
const user = { nom: 'Ada', age: 36 };
```
- [ ] `string | number`
- [x] `number`
- [ ] `unknown`
- [ ] `'age'`
> `K` est inféré au littéral `'age'`, et `T[K]` (indexed access) donne le type de cette propriété : `number`. C'est la base de nombreuses API typées (lodash `get`, ORM, form libraries).
[doc]: Handbook — Using type parameters in constraints | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Pourquoi ce générique est-il considéré comme inutile ?
```ts
function log<T>(value: T): void { console.log(value); }
```
- [ ] Les génériques sont interdits avec `void`
- [x] `T` n'apparaît qu'une seule fois : il ne relie rien, `value: unknown` suffit
- [ ] Il faut une contrainte `T extends object`
- [ ] `console.log` n'accepte pas de générique
> Règle d'or : un paramètre de type sert à **relier** plusieurs positions (paramètre ↔ retour, paramètre ↔ paramètre). S'il n'apparaît qu'une fois, il n'apporte rien et complique la signature.
[doc]: Handbook — Guidelines for writing good generic functions | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quel est le type de `R` ?
```ts
interface ApiResponse<T = unknown> { data: T }
type R = ApiResponse;
```
- [ ] Erreur : paramètre de type manquant
- [ ] `ApiResponse<any>`
- [x] `ApiResponse<unknown>`
- [ ] `ApiResponse<never>`
> Un paramètre de type avec **valeur par défaut** peut être omis. Sans défaut, `ApiResponse` sans argument serait une erreur (« Generic type requires 1 type argument »).
[doc]: Handbook — Generic parameter defaults | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Pourquoi ce code ne compile-t-il pas ?
```ts
class Boite<T> {
  static defaut: T;
}
```
- [ ] Les classes génériques ne peuvent pas avoir de membres statiques
- [x] Un membre statique ne peut pas référencer le paramètre de type de la classe
- [ ] Il faut initialiser `defaut`
- [ ] `T` doit avoir une contrainte
> Les membres statiques appartiennent à la classe elle-même, partagée par `Boite<string>` et `Boite<number>` : `T` n'a pas de sens à ce niveau.
[doc]: Handbook — Generic classes | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Que change le modificateur `const` sur le paramètre de type ?
```ts
function f<const T>(x: T): T { return x; }
const r = f({ roles: ['admin', 'user'] });
```
- [ ] `T` devient immuable à l'exécution
- [x] L'inférence se fait comme si l'appelant avait écrit `as const` : `{ readonly roles: readonly ['admin', 'user'] }`
- [ ] `T` ne peut plus être fourni explicitement
- [ ] Rien, c'est une erreur de syntaxe
> Les *const type parameters* (TS 5.0) évitent de demander `as const` à chaque appelant : utile pour des builders de routes, des configs ou des schémas.
[doc]: Release notes TS 5.0 — const type parameters (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
[niveau]: avancé

### Avec `strictFunctionTypes`, quelle affectation est valide ? (`Chien` étend `Animal`)
```ts
declare let fAnimal: (a: Animal) => void;
declare let fChien: (c: Chien) => void;
```
- [x] `fChien = fAnimal`
- [ ] `fAnimal = fChien`
- [ ] Les deux
- [ ] Aucune
> Les paramètres sont **contravariants** : une fonction qui sait traiter n'importe quel `Animal` peut être utilisée là où l'on attend un traitement de `Chien`. L'inverse est dangereux : `fChien` pourrait appeler `c.aboyer()` sur un chat.
[doc]: Référence tsconfig — strictFunctionTypes | https://www.typescriptlang.org/fr/tsconfig#strictFunctionTypes
[niveau]: avancé

### Quelle syntaxe déclare une fonction fléchée générique dans un fichier `.ts` ?
- [x] `const id = <T,>(x: T): T => x;`
- [ ] `const id<T> = (x: T): T => x;`
- [ ] `const id = (x: T) => x;`
- [ ] `const id = generic<T>(x => x);`
> `<T>(x: T) => x` fonctionne dans un `.ts`. Dans un `.tsx`, `<T>` serait confondu avec une balise JSX : on écrit alors `<T,>` ou `<T extends unknown>`. La forme `<T,>` marche partout.
[doc]: Handbook — Generic types | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Quel est le type de `p` ?
```ts
async function charger(): Promise<{ id: number }[]> { return []; }
type P = Awaited<ReturnType<typeof charger>>;
declare const p: P;
```
- [ ] `Promise<{ id: number }[]>`
- [x] `{ id: number }[]`
- [ ] `ReturnType<() => Promise>`
- [ ] `unknown`
> `typeof charger` donne le type de la fonction, `ReturnType` extrait `Promise<...>`, `Awaited` déroule la promesse (récursivement). Combo très courant pour typer des résultats sans les redéclarer.
[doc]: Utility types — Awaited (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype

### Pourquoi les méthodes déclarées avec la syntaxe `m(x: T): void` sont-elles moins sûres que `m: (x: T) => void` ?
- [ ] Elles ne sont pas typées
- [x] Les paramètres des méthodes restent bivariants même avec `strictFunctionTypes`
- [ ] Elles ne peuvent pas être génériques
- [ ] Elles sont effacées à la compilation
> Pour des raisons de compatibilité (notamment `Array<T>`), TS vérifie les paramètres de **méthodes** de façon bivariante. Les **propriétés de type fonction** bénéficient du contrôle contravariant strict.
[doc]: Référence tsconfig — strictFunctionTypes | https://www.typescriptlang.org/fr/tsconfig#strictFunctionTypes
[niveau]: avancé

### Que signifie `interface Producteur<out T> { get(): T }` ?
- [ ] `T` est exporté du module
- [x] `T` est annoté comme covariant : il n'apparaît qu'en position de sortie
- [ ] `T` est optionnel
- [ ] `T` ne peut pas être un objet
> Les annotations de variance `in`/`out` (TS 4.7) documentent et accélèrent la vérification. TS signale une erreur si `T` est utilisé en entrée alors qu'il est déclaré `out`.
[doc]: Release notes TS 4.7 — Variance annotations (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html
[niveau]: avancé

### Comment typer une fonction qui fusionne deux objets en conservant les deux types ?
- [ ] `function merge(a: object, b: object): object`
- [x] `function merge<A extends object, B extends object>(a: A, b: B): A & B`
- [ ] `function merge<T>(a: T, b: T): T`
- [ ] `function merge(a: any, b: any): any`
> Deux paramètres de type indépendants, et une intersection en retour. La version `<T>(a: T, b: T)` forcerait les deux objets à avoir le même type (ou une union inférée).
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Dans NestJS, `Type<T>` est défini comme `interface Type<T = any> extends Function { new (...args: any[]): T }`. À quoi sert-il ?
- [ ] À typer une instance de `T`
- [x] À typer une **classe** (un constructeur) qui produit des instances de `T`
- [ ] À créer des types à l'exécution
- [ ] À déclarer un provider singleton
> C'est une signature de construction générique : `Type<UserService>` désigne la classe `UserService` elle-même, pas une instance. On le retrouve dans `moduleRef.get(Type<T>)`, les mixins et les `Test.createTestingModule`.
[doc]: Handbook — Using class types in generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Quelles affirmations sur les génériques sont vraies ? (plusieurs réponses)
- [x] Ils sont entièrement effacés à la compilation
- [x] On peut leur donner une contrainte et une valeur par défaut
- [ ] On peut écrire `new T()` dans une fonction générique
- [ ] `T` est accessible à l'exécution via `typeof T`
> Comme tous les types, les génériques disparaissent au runtime : impossible de faire `new T()` ou de lire `T`. Pour instancier, il faut passer le constructeur en paramètre : `function create<T>(ctor: new () => T): T`.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Quel est le type de `b.contenu` ?
```ts
interface Boite<T = string> { contenu: T }
const b: Boite = { contenu: 'livre' };
```
- [ ] `unknown`
- [x] `string`
- [ ] `any`
- [ ] Erreur : il manque l'argument de type
> Un paramètre de type peut avoir une **valeur par défaut**, utilisée quand on ne précise rien et qu'il n'y a rien à inférer. Exemple réel : `Type<T = any>` dans NestJS, ou `Promise<T>` dans certaines signatures de librairies.
[doc]: Handbook — Generic parameter defaults | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Ce code compile-t-il ?
```ts
function paire<T>(a: T, b: T): [T, T] {
  return [a, b];
}
paire(1, 'a');
```
- [ ] Oui, `T` est inféré `string | number`
- [x] Non : `T` est inféré `number` et `'a'` n'est pas assignable à `number`
- [ ] Oui, `T` est inféré `unknown`
- [ ] Non : un générique ne peut apparaître qu'une fois dans les paramètres
> Face à plusieurs candidats, TS ne fabrique pas d'union automatiquement : il retient un candidat et vérifie les autres. Si l'union est voulue, on l'explicite : `paire<string | number>(1, 'a')`.
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: avancé

### Pourquoi cette classe ne compile-t-elle pas ?
```ts
class Pile<T> {
  static vide: T[] = [];
}
```
- [ ] Une classe générique ne peut pas avoir de membres statiques
- [x] Un membre statique ne peut pas référencer le paramètre de type de la classe
- [ ] Il faut initialiser `vide` dans le constructeur
- [ ] Il faut écrire `static vide: Array<T>`
> Les membres statiques appartiennent à la **classe** (unique), pas à une instance `Pile<number>` ou `Pile<string>`. Le paramètre `T` n'a donc pas de sens à ce niveau.
[doc]: Handbook — Generic classes | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Que change `NoInfer` (TS 5.4) dans cette signature ?
```ts
function creerMachine<S extends string>(etats: S[], initial: NoInfer<S>) {}
creerMachine(['idle', 'loading'], 'done');
```
- [ ] Rien, c'est un alias de `S`
- [x] `S` est inféré uniquement depuis `etats`, donc `'done'` est refusé
- [ ] `initial` devient de type `unknown`
- [ ] Il empêche d'inférer `S` partout, il faut l'expliciter
> Sans `NoInfer`, TS utiliserait aussi `initial` comme source d'inférence et `S` deviendrait `'idle' | 'loading' | 'done'` — sans erreur. `NoInfer<T>` exclut une position de l'inférence pour qu'elle serve seulement de vérification.
[doc]: TypeScript 5.4 — NoInfer | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html
[niveau]: avancé

### Quel est le type de `m` ?
```ts
const m = new Map();
```
- [ ] `Map<unknown, unknown>`
- [x] `Map<any, any>`
- [ ] `Map<never, never>`
- [ ] `Map<string, any>`
> Sans argument ni type explicite, il n'y a rien à inférer et `Map` retombe sur `any` : on perd tout contrôle. Écrivez `new Map<string, number>()` (même logique pour `new Set<string>()` ou `useState<User | null>(null)`).
[doc]: Handbook — Generics | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html

### Pourquoi cette fonction ne compile-t-elle pas ?
```ts
function defaut<T extends string>(): T {
  return 'a';
}
```
- [ ] `T` doit avoir une valeur par défaut
- [x] `T` pourrait être un sous-type plus étroit, comme `'b'`, auquel `'a'` n'est pas assignable
- [ ] Une fonction générique doit avoir au moins un paramètre
- [ ] `'a'` n'est pas une `string`
> La contrainte `extends string` donne une borne, pas le type exact : l'appelant peut choisir `defaut<'b'>()`. Le corps doit fonctionner pour **tout** `T` possible. Si la fonction renvoie toujours une `string`, le générique est inutile.
[doc]: Handbook — Generic constraints | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: avancé

### Quel appel ne compile pas ?
```ts
function plusLong<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
```
- [ ] `plusLong([1, 2], [1, 2, 3])`
- [ ] `plusLong('alice', 'bob')`
- [x] `plusLong(10, 100)`
- [ ] Ils compilent tous
> La contrainte exige une propriété `length` : tableaux et chaînes l'ont, pas `number`. Et le type de retour reste précis : `number[]` dans le premier cas, `string` dans le second.
[doc]: Handbook — Generic constraints | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
[niveau]: facile

### Quel est le type de `emails` ?
```ts
function extraire<T, K extends keyof T>(items: T[], cle: K): T[K][] {
  return items.map((item) => item[cle]);
}
declare const users: { id: number; email: string }[];
const emails = extraire(users, 'email');
```
- [ ] `unknown[]`
- [ ] `(string | number)[]`
- [x] `string[]`
- [ ] `T[K][]`
> `T` est inféré depuis `users`, `K` depuis `'email'` (le littéral, grâce à la contrainte `keyof T`), puis `T[K]` se résout en `string`. Un appel avec `'nom'` serait refusé à la compilation.
[doc]: Handbook — keyof dans les génériques | https://www.typescriptlang.org/fr/docs/handbook/2/generics.html
