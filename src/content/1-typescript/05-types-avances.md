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

## S'entraîner

Les [Type Challenges](https://github.com/type-challenges/type-challenges) font réimplémenter les types vus ci-dessus. Chaque défi s'ouvre dans le Playground avec ses tests, et les solutions de la communauté sont consultables (énoncés en anglais). Classés par section du cours, du plus simple au plus dur :

- **keyof et accès indexé** : [Tuple to Union](https://tsch.js.org/10), [Type Lookup](https://tsch.js.org/62)
- **Utility types** : [Pick](https://tsch.js.org/4), [Readonly](https://tsch.js.org/7), [Exclude](https://tsch.js.org/43), [Parameters](https://tsch.js.org/3312), [Get Return Type](https://tsch.js.org/2), [Omit](https://tsch.js.org/3)
- **Mapped types** : [Tuple to Object](https://tsch.js.org/11), [Readonly 2](https://tsch.js.org/8), [Mutable](https://tsch.js.org/2793), [PickByType](https://tsch.js.org/2595), [Deep Readonly](https://tsch.js.org/9)
- **Conditional types** : [If](https://tsch.js.org/268), [IsNever](https://tsch.js.org/1042), [AnyOf](https://tsch.js.org/949)
- **infer** : [First of Array](https://tsch.js.org/14), [Last of Array](https://tsch.js.org/15), [Awaited](https://tsch.js.org/189), [Pop](https://tsch.js.org/16)
- **Template literal types** : [Capitalize](https://tsch.js.org/110), [Trim Left](https://tsch.js.org/106), [Replace](https://tsch.js.org/116), [StartsWith](https://tsch.js.org/2688)

<!-- QUIZ -->

### Quel est le type de `C` ?
```ts
const config = { port: 3000, host: 'localhost' };
type C = typeof config;
```
- [x] `{ port: number; host: string }`
- [ ] `'object'`
- [ ] `{ port: 3000; host: 'localhost' }`
- [ ] `'port' | 'host'`
> Utilisé dans une position de type, `typeof` récupère le type d'une **valeur** existante. Les propriétés sont élargies (`number`, `string`) car l'objet n'est pas `as const`. À ne pas confondre avec le `typeof` JavaScript, qui renvoie une chaîne à l'exécution.
[doc]: Handbook — typeof | https://www.typescriptlang.org/fr/docs/handbook/2/typeof-types.html
[niveau]: facile

### Quel est le type de `E` ?
```ts
interface User { id: number; email: string }
type E = User['email'];
```
- [x] `string`
- [ ] `'email'`
- [ ] `User`
- [ ] Erreur : on ne peut pas indexer une interface
> L'**accès indexé** `T['cle']` lit le type d'une propriété, comme on lirait sa valeur. Pratique pour réutiliser un type sans le recopier : si `email` change de type, `E` suit.
[doc]: Handbook — Indexed access types | https://www.typescriptlang.org/fr/docs/handbook/2/indexed-access-types.html
[niveau]: facile

### Quel est l'effet de `Partial<User>` ?
```ts
interface User { nom: string; age: number }
```
- [x] Toutes les propriétés deviennent optionnelles : `{ nom?: string; age?: number }`
- [ ] Seule la première propriété est conservée
- [ ] Les propriétés deviennent `readonly`
- [ ] Les propriétés peuvent valoir `null`
> `Partial<T>` ajoute `?` à chaque propriété. Usage typique : un DTO de mise à jour, où l'on n'envoie que les champs modifiés. Son inverse est `Required<T>`.
[doc]: Utility types — Partial (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
[niveau]: facile

### Comment obtenir un type `PublicUser` identique à `User` mais sans `password` ?
```ts
interface User { id: number; email: string; password: string }
```
- [x] `type PublicUser = Omit<User, 'password'>`
- [ ] `type PublicUser = Pick<User, 'password'>`
- [ ] `type PublicUser = Exclude<User, 'password'>`
- [ ] `type PublicUser = Partial<User>`
> `Omit<T, K>` retire des clés d'un type objet. `Pick<User, 'password'>` ferait l'inverse (ne garder que `password`), et `Exclude` travaille sur les membres d'une union, pas sur les propriétés.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
[niveau]: facile

### Quel est le type de `Apercu` ?
```ts
interface Article { id: number; titre: string; contenu: string }
type Apercu = Pick<Article, 'id' | 'titre'>;
```
- [x] `{ id: number; titre: string }`
- [ ] `{ contenu: string }`
- [ ] `'id' | 'titre'`
- [ ] `{ id?: number; titre?: string }`
> `Pick<T, K>` ne garde que les clés listées dans `K`, avec leur type d'origine. On l'utilise pour exposer une vue réduite d'un modèle (liste, aperçu) sans redéclarer les champs.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
[niveau]: facile

### Quel est l'équivalent de `Record<'fr' | 'en', string>` ?
- [x] `{ fr: string; en: string }`
- [ ] `{ fr?: string; en?: string }`
- [ ] `['fr' | 'en', string]`
- [ ] `string[]`
> `Record<K, V>` construit un objet dont les clés sont `K` et les valeurs `V`. Si `K` est une union de littéraux, **toutes** les clés sont obligatoires : idéal pour une table de traductions où aucune langue ne doit manquer.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
[niveau]: facile

### Que se passe-t-il à la dernière ligne ?
```ts
const u: Readonly<{ nom: string }> = { nom: 'Ada' };
u.nom = 'Grace';
```
- [ ] `u.nom` vaut `'Grace'`
- [x] Erreur de compilation : `nom` est en lecture seule
- [ ] Erreur à l'exécution : l'objet est gelé
- [ ] L'affectation est ignorée silencieusement
> `Readonly<T>` rend toutes les propriétés `readonly`, au niveau des **types** seulement : rien n'est gelé à l'exécution (pour cela, `Object.freeze`). L'effet est aussi superficiel : les objets imbriqués restent modifiables.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
[niveau]: facile

### Quel est le type de `T` ?
```ts
type T = NonNullable<string | null | undefined>;
```
- [x] `string`
- [ ] `string | null`
- [ ] `never`
- [ ] `string | undefined`
> `NonNullable<T>` retire `null` et `undefined` d'une union. Pratique pour décrire une valeur après une vérification `if (x != null)`, ou le résultat d'un `filter` qui élimine les vides.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html
[niveau]: facile

### Quel est le type de `A` ?
```ts
type EstTexte<T> = T extends string ? 'oui' : 'non';
type A = EstTexte<number>;
```
- [ ] `'oui'`
- [x] `'non'`
- [ ] `'oui' | 'non'`
- [ ] `boolean`
> Un **type conditionnel** se lit comme un ternaire : si `T` est assignable à `string`, on obtient la première branche, sinon la seconde. `number` n'est pas une `string` : le résultat est `'non'`.
[doc]: Handbook — Conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html
[niveau]: facile

### Quelles valeurs sont acceptées par ce type ? (plusieurs réponses)
```ts
type UserKey = `user-${number}`;
```
- [x] `'user-42'`
- [x] `'user-7'`
- [ ] `'user-abc'`
- [ ] `'admin-1'`
> Un **template literal type** décrit un motif de chaîne : ici le préfixe `user-` suivi d'un nombre. Le compilateur refuse toute chaîne littérale qui ne correspond pas au motif.
[doc]: Handbook — Template literal types | https://www.typescriptlang.org/fr/docs/handbook/2/template-literal-types.html
[niveau]: facile

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
[niveau]: facile

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
[niveau]: avancé

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
[niveau]: avancé

### Comment supprimer une clé dans un mapped type avec `as` ?
- [ ] En renvoyant `undefined`
- [x] En renvoyant `never` pour cette clé
- [ ] En renvoyant `null`
- [ ] Ce n'est pas possible, il faut `Omit`
> `{ [K in keyof T as T[K] extends Function ? never : K]: T[K] }` retire toutes les méthodes. Une clé remappée en `never` disparaît du résultat.
[doc]: Handbook — Key remapping via as | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html
[niveau]: avancé

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
[niveau]: facile

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
[niveau]: facile

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
[niveau]: avancé

### Quels utilitaires agissent sur les membres d'une union (et non sur les propriétés d'un objet) ? (plusieurs réponses)
- [x] `Exclude`
- [x] `Extract`
- [x] `NonNullable`
- [ ] `Pick`
> `Pick`, `Omit`, `Partial`, `Required`, `Readonly` transforment les propriétés d'un type objet. `Exclude`, `Extract` et `NonNullable` (= `T & {}`) filtrent des unions.
[doc]: Utility types (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html

### Quel est le type de `Evenement` ?
```ts
type Evenement = `on${Capitalize<'click' | 'focus'>}`;
```
- [ ] `string`
- [ ] `'onclick' | 'onfocus'`
- [x] `'onClick' | 'onFocus'`
- [ ] `` `on${string}` ``
> Un template literal type appliqué à une union est **distribué** sur chaque membre. `Capitalize`, `Uncapitalize`, `Uppercase` et `Lowercase` sont des utilitaires intrinsèques pour manipuler les littéraux de chaîne.
[doc]: Handbook — Template literal types | https://www.typescriptlang.org/fr/docs/handbook/2/template-literal-types.html

### Quel est le type de `Cles` ?
```ts
type Cles = keyof { [cle: string]: boolean };
```
- [ ] `string`
- [x] `string | number`
- [ ] `never`
- [ ] `PropertyKey`
> En JavaScript, les clés numériques sont converties en chaînes (`obj[0]` équivaut à `obj['0']`). Une signature d'index `string` accepte donc aussi les clés `number`, et `keyof` renvoie `string | number`.
[doc]: Handbook — keyof | https://www.typescriptlang.org/fr/docs/handbook/2/keyof-types.html
[niveau]: avancé

### Comment obtenir le type de l'objet retourné par `creerUser` sans le réécrire ?
```ts
function creerUser() {
  return { id: 1, nom: 'Alice', admin: false };
}
```
- [ ] `type U = ReturnType<creerUser>`
- [x] `type U = ReturnType<typeof creerUser>`
- [ ] `type U = typeof creerUser()`
- [ ] `type U = Awaited<creerUser>`
> `ReturnType` attend un **type** de fonction : `typeof` fait le pont entre l'espace des valeurs et celui des types. Pour une fonction `async`, on combine : `Awaited<ReturnType<typeof fn>>`.
[doc]: Handbook — typeof | https://www.typescriptlang.org/fr/docs/handbook/2/typeof-types.html
[niveau]: facile

### Quel est le type de `R` ?
```ts
type EstString<T> = [T] extends [string] ? true : false;
type R = EstString<string | number>;
```
- [ ] `boolean`
- [ ] `true`
- [x] `false`
- [ ] `never`
> Entourer `T` de crochets **désactive la distributivité** : on teste l'union entière, et `string | number` n'est pas assignable à `string`. Sans crochets (`T extends string ? …`), le résultat aurait été distribué : `true | false`, soit `boolean`.
[doc]: Handbook — Distributive conditional types | https://www.typescriptlang.org/fr/docs/handbook/2/conditional-types.html
[niveau]: avancé

### Que produit ce mapped type ?
```ts
type Modifiable<T> = { -readonly [K in keyof T]-?: T[K] };
type R = Modifiable<{ readonly id: number; nom?: string }>;
```
- [ ] `{ readonly id: number; nom?: string }`
- [x] `{ id: number; nom: string }`
- [ ] `{ id: number; nom: string | undefined }`
- [ ] Une erreur de syntaxe
> Les préfixes `-` et `+` ajoutent ou retirent les modificateurs `readonly` et `?`. `-?` est exactement ce que fait l'utilitaire `Required<T>` ; `-readonly` n'a pas d'équivalent intégré.
[doc]: Handbook — Mapping modifiers | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html

### Quelles valeurs ne sont **pas** assignables à ce type ? (plusieurs réponses)
```ts
type Json = string | number | boolean | null | Json[] | { [cle: string]: Json };
```
- [ ] `{ tags: ['a', 1, null] }`
- [ ] `'texte'`
- [x] `{ a: undefined }`
- [x] `{ calcul: () => 42 }`
> Un alias de type peut être **récursif**. Ce type décrit fidèlement ce que `JSON.stringify` sait représenter : `undefined` et les fonctions en sont exclus (ils sont omis à la sérialisation), tout comme `Date` (devenue une chaîne).
[doc]: Handbook — Objets et alias de types | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html
[niveau]: avancé

### Comment obtenir le type `number` du prix d'une ligne de commande ?
```ts
interface Commande {
  lignes: { produit: string; prix: number }[];
}
```
- [ ] `Commande.lignes.prix`
- [ ] `Commande['lignes']['prix']`
- [x] `Commande['lignes'][number]['prix']`
- [ ] `typeof Commande.lignes[0].prix`
> L'accès indexé `T['cle']` se chaîne. `[number]` donne le type des éléments d'un tableau. Utile pour typer un composant `<LigneCommande>` sans dupliquer la définition.
[doc]: Handbook — Indexed access types | https://www.typescriptlang.org/fr/docs/handbook/2/indexed-access-types.html

### Pourquoi écrire `string & K` dans ce mapped type ?
```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
```
- [ ] Pour rendre les clés optionnelles
- [x] Parce que `keyof T` peut contenir des `number` et des `symbol`, que `Capitalize` n'accepte pas
- [ ] Pour forcer les valeurs à être des chaînes
- [ ] C'est inutile, `K` est toujours une `string`
> `keyof T` est de type `string | number | symbol`. L'intersection `string & K` ne garde que les clés chaînes (les autres deviennent `never` et disparaissent). `Getters<{ nom: string }>` donne `{ getNom: () => string }`.
[doc]: Handbook — Key remapping via as | https://www.typescriptlang.org/fr/docs/handbook/2/mapped-types.html
[niveau]: avancé
