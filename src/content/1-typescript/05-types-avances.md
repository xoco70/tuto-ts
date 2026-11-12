---
id: ts-types-avances
track: typescript
order: 5
title: Manipulation de types (utilitaires, mapped, conditional, infer)
level: Avancé
summary: keyof, typeof, types indexés, utility types, mapped types, conditional types, infer et template literal types.
---

## keyof, typeof et accès indexé

```ts
const config = { port: 3000, host: 'localhost' };
type Config = typeof config;               // { port: number; host: string }
type Cle = keyof Config;                   // 'port' | 'host'
type Port = Config['port'];                // number
type Valeurs = Config[keyof Config];       // number | string

const ROLES = ['admin', 'user'] as const;
type Role = (typeof ROLES)[number];        // 'admin' | 'user'
```

`typeof` au niveau type récupère le type d'une **valeur** ; `keyof` donne l'union des clés d'un **type**.

## Utility types essentiels

| Type | Effet |
| --- | --- |
| `Partial<T>` | toutes les propriétés optionnelles |
| `Required<T>` | toutes obligatoires |
| `Readonly<T>` | toutes `readonly` (superficiel) |
| `Pick<T, K>` | garde certaines clés |
| `Omit<T, K>` | retire certaines clés |
| `Record<K, V>` | objet de clés `K` vers `V` |
| `Exclude<U, X>` | retire des membres d'une **union** |
| `Extract<U, X>` | garde les membres d'une union assignables à `X` |
| `NonNullable<T>` | retire `null` et `undefined` |
| `ReturnType<F>` / `Parameters<F>` | retour / tuple des paramètres d'une fonction |
| `Awaited<T>` | déroule une `Promise` |
| `InstanceType<C>` | type d'instance d'une classe |

```ts
type CreateUserDto = Omit<User, 'id' | 'createdAt'>;
type UpdateUserDto = Partial<CreateUserDto>;
```

`Pick`/`Omit` travaillent sur les **clés d'un objet** ; `Extract`/`Exclude` sur les **membres d'une union**.

## Mapped types

```ts
type MonPartial<T> = { [K in keyof T]?: T[K] };
type Mutable<T> = { -readonly [K in keyof T]: T[K] };   // retire readonly
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];  // remappage de clés
};
type G = Getters<{ nom: string }>;  // { getNom: () => string }
```

- `-?` / `-readonly` retirent un modificateur, `+?` en ajoute.
- `as` permet de **renommer** ou de **filtrer** les clés (renvoyer `never` supprime la clé).

## Conditional types

```ts
type EstString<T> = T extends string ? true : false;
type A = EstString<'a'>;        // true
type B = EstString<number>;     // false
```

**Distributivité** : quand `T` est un paramètre « nu », le conditionnel s'applique à **chaque membre** d'une union.

```ts
type ToArray<T> = T extends any ? T[] : never;
type C = ToArray<string | number>;      // string[] | number[]
type ToArrayND<T> = [T] extends [any] ? T[] : never;
type D = ToArrayND<string | number>;    // (string | number)[]
```

`Exclude<T, U>` est justement implémenté ainsi : `T extends U ? never : T`.

## infer

```ts
type MonReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type ElementDe<T> = T extends (infer E)[] ? E : never;
type Unwrap<T> = T extends Promise<infer V> ? Unwrap<V> : T;  // récursif
```

`infer` déclare une variable de type **capturée** pendant le pattern matching, utilisable seulement dans la branche vraie.

## Template literal types

```ts
type Event = 'click' | 'focus';
type Handler = `on${Capitalize<Event>}`;   // 'onClick' | 'onFocus'
type Route = `/api/${'users' | 'posts'}/${number}`;
const r: Route = '/api/users/42';          // ✅
```

Ils se combinent aux unions par **produit cartésien** : `` `${'a' | 'b'}-${'x' | 'y'}` `` → 4 membres.

## Types « brandés » (nominal typing)

```ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
const asUserId = (s: string) => s as UserId;

function getUser(id: UserId) {}
getUser(asUserId('u1'));      // ✅
getUser('u1' as OrderId);     // ❌
```

Simule un typage nominal pour éviter de mélanger des identifiants de même type primitif.

<!-- QUIZ -->

### Quel est le type de `Cle` ?
```ts
const config = { port: 3000, host: 'localhost' };
type Cle = keyof typeof config;
```
- [ ] `string`
- [x] `'port' | 'host'`
- [ ] `number | string`
- [ ] Erreur : `keyof` ne s'applique pas à une valeur
> `typeof config` passe de la valeur à son type, puis `keyof` donne l'union des clés. `keyof config` (sans `typeof`) serait une erreur, car `keyof` attend un type.
[doc]: Handbook — keyof | https://www.typescriptlang.org/fr/docs/handbook/2/keyof-types.html

### Quelle est la différence entre `Omit` et `Exclude` ?
- [ ] Aucune, ce sont des alias
- [x] `Omit` retire des **clés d'un type objet** ; `Exclude` retire des **membres d'une union**
- [ ] `Exclude` retire des clés ; `Omit` retire des membres d'union
- [ ] `Omit` ne fonctionne que sur les interfaces
> `Omit<User, 'password'>` → objet sans `password`. `Exclude<'a' | 'b' | 'c', 'a'>` → `'b' | 'c'`. D'ailleurs `Omit<T, K>` est défini comme `Pick<T, Exclude<keyof T, K>>`.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html

### Quel est le type de `C` ?
```ts
type ToArray<T> = T extends any ? T[] : never;
type C = ToArray<string | number>;
```
- [ ] `(string | number)[]`
- [x] `string[] | number[]`
- [ ] `never`
- [ ] `any[]`
> Un conditional type sur un paramètre nu est **distributif** : il est appliqué à chaque membre de l'union puis les résultats sont réunis. Pour l'éviter, on entoure de crochets : `[T] extends [any]`.
[doc]: Handbook — Distributive conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html

### Que produit ce mapped type ?
```ts
type X<T> = { -readonly [K in keyof T]-?: T[K] };
type R = X<{ readonly a?: number }>;
```
- [ ] `{ readonly a?: number }`
- [x] `{ a: number }`
- [ ] `{ a?: number }`
- [ ] `{ readonly a: number }`
> Les préfixes `-` retirent les modificateurs : `-readonly` rend modifiable, `-?` rend obligatoire (et retire le `undefined` ajouté par l'optionnalité). C'est l'implémentation de `Required` + `Mutable`.
[doc]: Handbook — Mapping modifiers | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html

### Que permet `infer` ?
```ts
type ElementDe<T> = T extends (infer E)[] ? E : never;
```
- [ ] Inférer le type d'une variable à l'exécution
- [x] Capturer une partie d'un type pendant un test conditionnel pour la réutiliser dans la branche vraie
- [ ] Remplacer `any`
- [ ] Désactiver la distributivité
> `infer E` agit comme une variable de *pattern matching* : si `T` correspond à `E[]`, `E` vaut le type des éléments. `ElementDe<string[]>` → `string`.
[doc]: Handbook — Inferring within conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html

### Quel est le type de `G` ?
```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type G = Getters<{ nom: string; age: number }>;
```
- [ ] `{ nom: () => string; age: () => number }`
- [x] `{ getNom: () => string; getAge: () => number }`
- [ ] `{ get: () => string | number }`
- [ ] Erreur : `as` est interdit dans un mapped type
> Le *key remapping* (`as`, TS 4.1) renomme les clés via un template literal type. `string & K` sert à exclure les clés `symbol`/`number` que `Capitalize` n'accepte pas.
[doc]: Handbook — Key remapping via as | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html

### Comment supprimer une clé dans un mapped type avec `as` ?
- [ ] En renvoyant `undefined`
- [x] En renvoyant `never` pour cette clé
- [ ] En renvoyant `null`
- [ ] Ce n'est pas possible, il faut `Omit`
> `{ [K in keyof T as T[K] extends Function ? never : K]: T[K] }` retire toutes les méthodes. Une clé remappée en `never` disparaît du résultat.
[doc]: Handbook — Key remapping via as | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html

### Combien de membres contient ce type ?
```ts
type T = `${'get' | 'set'}${'Nom' | 'Age' | 'Email'}`;
```
- [ ] 2
- [ ] 5
- [x] 6
- [ ] 1
> Les unions dans un template literal type se combinent en **produit cartésien** : 2 × 3 = 6 (`getNom`, `getAge`, …, `setEmail`). Attention à l'explosion combinatoire sur de grosses unions.
[doc]: Handbook — Template literal types | https://www.typescriptlang.org/fr/docs/handbook/2/template-literal-types.html

### Quel est le type de `Role` ?
```ts
const ROLES = ['admin', 'editor', 'user'] as const;
type Role = (typeof ROLES)[number];
```
- [ ] `string`
- [ ] `readonly string[]`
- [x] `'admin' | 'editor' | 'user'`
- [ ] `number`
> L'accès indexé `[number]` sur un tuple donne l'union de ses éléments. Ce pattern permet d'avoir **une seule source de vérité** : la liste des valeurs (utilisable au runtime, ex. `@IsIn(ROLES)`) et le type dérivé.
[doc]: Handbook — Indexed access types | https://www.typescriptlang.org/fr/docs/handbook/2/indexed-access-types.html

### Quel utilitaire donne le tuple des paramètres d'une fonction ?
- [ ] `Arguments<F>`
- [x] `Parameters<F>`
- [ ] `ReturnType<F>`
- [ ] `Args<F>`
> `Parameters<(a: string, b?: number) => void>` → `[a: string, b?: number]`. Utile pour écrire un wrapper qui garde la signature : `(...args: Parameters<typeof fn>) => ...`.
[doc]: Utility types — Parameters (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#parameterstype

### À quoi sert un « branded type » comme `type UserId = string & { __brand: 'UserId' }` ?
- [ ] À valider le format d'une chaîne à l'exécution
- [x] À empêcher de passer une chaîne quelconque (ou un `OrderId`) là où l'on attend un `UserId`
- [ ] À chiffrer l'identifiant
- [ ] À créer une classe `UserId`
> TS est structurel : deux alias de `string` sont interchangeables. Le *brand* (propriété fantôme qui n'existe jamais au runtime) recrée un typage **nominal**. On construit les valeurs via une fonction qui valide puis caste.
[doc]: Playground — Nominal typing (EN) | https://www.typescriptlang.org/play/?q=10#example/nominal-typing

### Quel est le type de `R` ?
```ts
type R = Extract<'a' | 'b' | 1 | 2, string>;
```
- [ ] `1 | 2`
- [x] `'a' | 'b'`
- [ ] `string`
- [ ] `never`
> `Extract<U, X>` garde les membres de `U` assignables à `X`. Son inverse, `Exclude<'a' | 'b' | 1 | 2, string>`, donnerait `1 | 2`.
[doc]: Utility types — Extract (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union

### Quel est le type de `R` ?
```ts
type Unwrap<T> = T extends Promise<infer V> ? Unwrap<V> : T;
type R = Unwrap<Promise<Promise<number>>>;
```
- [ ] `Promise<number>`
- [x] `number`
- [ ] `never`
- [ ] Erreur : types récursifs interdits
> Les conditional types peuvent être **récursifs**. `Unwrap` déroule chaque niveau de promesse : c'est le principe de `Awaited<T>`.
[doc]: Handbook — Conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html

### Comment écrire un DTO de mise à jour dont tous les champs sont optionnels, sans l'`id` ?
```ts
interface User { id: string; nom: string; email: string }
```
- [ ] `Partial<User>`
- [x] `Partial<Omit<User, 'id'>>`
- [ ] `Omit<Partial<User>, 'nom' | 'email'>`
- [ ] `Required<Omit<User, 'id'>>`
> On retire `id` puis on rend tout optionnel. NestJS fournit l'équivalent pour les classes DTO (qui gardent les décorateurs de validation) : `PartialType(OmitType(CreateUserDto, ['id']))` depuis `@nestjs/mapped-types` ou `@nestjs/swagger`.
[doc]: Utility types — Partial (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype

### Quel est le type de `R` ?
```ts
type IsNever<T> = T extends never ? true : false;
type R = IsNever<never>;
```
- [ ] `true`
- [ ] `false`
- [x] `never`
- [ ] `boolean`
> Piège classique : `never` est une **union vide**. Un conditional distributif appliqué à une union vide produit… une union vide, donc `never`. La version correcte : `[T] extends [never] ? true : false`.
[doc]: Handbook — Distributive conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html

### Quels utilitaires agissent sur les membres d'une union (et non sur les propriétés d'un objet) ? (plusieurs réponses)
- [x] `Exclude`
- [x] `Extract`
- [x] `NonNullable`
- [ ] `Pick`
> `Pick`, `Omit`, `Partial`, `Required`, `Readonly` transforment les propriétés d'un type objet. `Exclude`, `Extract` et `NonNullable` (= `T & {}`) filtrent des unions.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
