---
id: ts-fonctions-objets
track: typescript
order: 2
title: Fonctions, objets, interface vs type
level: Débutant
summary: Typer des fonctions (surcharges, this, paramètres optionnels), modéliser des objets, choisir entre interface et type.
---

## Typer une fonction

```ts
function somme(a: number, b: number): number {
  return a + b;
}

const multiplier = (a: number, b = 2): number => a * b; // b inféré number, optionnel
function log(message: string, niveau?: 'info' | 'warn'): void {}
function total(...prix: number[]): number { return prix.reduce((s, p) => s + p, 0); }
```

- Un paramètre avec **valeur par défaut** est automatiquement optionnel.
- Un paramètre optionnel (`?`) doit venir **après** les paramètres obligatoires.
- Annoter le **type de retour** des fonctions exportées évite qu'un changement interne modifie silencieusement l'API publique.

### Types de fonctions

```ts
type Comparateur<T> = (a: T, b: T) => number;
interface Handler { (event: string): void }          // signature d'appel
interface Constructible { new (nom: string): object } // signature de construction
```

### Surcharges

```ts
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  return typeof input === 'string' ? Number(input) : String(input);
}
parse('42');  // number
parse(42);    // string
```

La signature d'**implémentation** (la dernière) n'est **pas visible** de l'extérieur. Souvent, une union ou un générique fait mieux qu'une surcharge.

### `this` typé

```ts
function onClick(this: HTMLButtonElement, e: MouseEvent) {
  this.disabled = true;
}
```
Le paramètre `this` est un faux paramètre : il est effacé à la compilation.

## Modéliser des objets

```ts
interface User {
  readonly id: string;       // non réassignable (contrôle statique seulement)
  nom: string;
  email?: string;            // optionnel
  [cle: string]: unknown;    // signature d'index : clés supplémentaires
}

type Dictionnaire = Record<string, number>;
```

`readonly` est superficiel (*shallow*) : `readonly tags: string[]` empêche `user.tags = []` mais pas `user.tags.push('x')`. Pour ça : `readonly string[]` ou `ReadonlyArray<string>`.

## interface vs type

```ts
interface Animal { nom: string }
interface Chien extends Animal { aboie(): void }

type AnimalT = { nom: string };
type ChienT = AnimalT & { aboie(): void };   // intersection
type Id = string | number;                    // union : seulement avec type
type Paire = [string, number];                // tuple : seulement avec type
```

| | `interface` | `type` |
| --- | --- | --- |
| Objets / classes | ✅ | ✅ |
| Unions, tuples, primitifs, types mappés/conditionnels | ❌ | ✅ |
| Fusion de déclarations (*declaration merging*) | ✅ | ❌ (erreur « Duplicate identifier ») |
| `extends` | ✅ (vérifie la compatibilité) | via `&` (intersection) |

Convention répandue : **`interface` pour les formes d'objets publiques** (extensibles, meilleurs messages d'erreur), **`type` pour tout le reste**. L'important est d'être cohérent.

La **fusion de déclarations** est ce qui permet d'augmenter des types de librairies :

```ts
// Ajouter `user` à la Request d'Express
declare global {
  namespace Express {
    interface Request { user?: { id: string } }
  }
}
```

## Intersections et conflits

```ts
type A = { id: string };
type B = { id: number };
type C = A & B;   // id: string & number → never
```

Une intersection de types objet **combine** les propriétés ; si une même propriété a des types incompatibles, elle devient `never`.

## Déstructuration typée

```ts
function creer({ nom, age = 18 }: { nom: string; age?: number }) {}
const [premier, ...reste]: number[] = [1, 2, 3];
```

Attention : `function f({ nom: string })` **renomme** `nom` en une variable `string` — ce n'est pas une annotation !

<!-- QUIZ -->

### Quelle construction est impossible avec `interface` mais possible avec `type` ?
- [ ] Décrire la forme d'un objet
- [ ] Étendre un autre type
- [x] Définir une union comme `string | number`
- [ ] Déclarer une méthode
> Les unions, tuples, alias de primitifs, types mappés et conditionnels ne peuvent s'exprimer qu'avec `type`. Une `interface` décrit toujours une forme d'objet (ou de fonction).
[doc]: Handbook — Différences entre type et interface | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Que se passe-t-il si on déclare deux fois la même `interface` dans le même scope ?
```ts
interface Config { port: number }
interface Config { host: string }
```
- [ ] Erreur « Duplicate identifier »
- [ ] La seconde remplace la première
- [x] Les déclarations fusionnent : `Config` a `port` et `host`
- [ ] Seule la première est prise en compte
> C'est la **fusion de déclarations** (*declaration merging*), propre aux interfaces. Elle sert notamment à augmenter les types d'une librairie (ex : ajouter `user` à `Express.Request`). Deux `type` du même nom provoqueraient une erreur.
[doc]: Declaration Merging (EN) | https://www.typescriptlang.org/docs/handbook/declaration-merging.html

### Quel est le type de la propriété `id` dans `C` ?
```ts
type A = { id: string };
type B = { id: number };
type C = A & B;
```
- [ ] `string | number`
- [x] `never`
- [ ] `string`
- [ ] Erreur de compilation immédiate
> L'intersection exige que `id` soit à la fois `string` **et** `number` : aucune valeur ne satisfait cela, donc `never`. Pas d'erreur à la déclaration, mais impossible de construire un `C`. Avec `interface B extends A`, TS signalerait l'incompatibilité dès la déclaration.
[doc]: Handbook — Intersection types | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Quel type est retourné par `parse(42)` ?
```ts
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  return typeof input === 'string' ? Number(input) : String(input);
}
```
- [ ] `string | number`
- [x] `string`
- [ ] `number`
- [ ] `any`
> TS choisit la **première surcharge compatible** (`input: number` → `string`). La signature d'implémentation n'est pas visible depuis l'extérieur.
[doc]: Handbook — Surcharges de fonctions | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Que fait ce code ?
```ts
function afficher({ nom: string }) {
  console.log(nom);
}
```
- [ ] Il annote `nom` comme `string`
- [x] Il renomme la propriété `nom` en une variable locale appelée `string` ; `nom` n'existe pas
- [ ] Il est équivalent à `({ nom }: { nom: string })`
- [ ] Il déclare une valeur par défaut
> Dans une déstructuration, `{ a: b }` signifie « prendre `a` et l'appeler `b` ». L'annotation de type se place après le motif complet : `({ nom }: { nom: string })`. Erreur classique en entretien.
[doc]: Handbook — Paramètres déstructurés | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Ce code compile-t-il ?
```ts
interface User { readonly tags: string[] }
const u: User = { tags: [] };
u.tags.push('admin');
```
- [x] Oui : `readonly` protège la propriété, pas le contenu du tableau
- [ ] Non : `tags` est readonly
- [ ] Non : `push` n'existe pas sur un tableau readonly
- [ ] Oui, mais lève une erreur à l'exécution
> `readonly` est superficiel : il interdit `u.tags = [...]` mais pas la mutation du tableau. Pour empêcher `push`, il faut `readonly tags: readonly string[]`. Et rien de tout cela n'existe à l'exécution (sauf `Object.freeze`).
[doc]: Handbook — readonly | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Quelle déclaration de paramètres est invalide ?
- [ ] `function f(a: number, b?: number)`
- [ ] `function f(a: number, b = 2)`
- [x] `function f(a?: number, b: number)`
- [ ] `function f(a: number, ...rest: number[])`
> Un paramètre obligatoire ne peut pas suivre un paramètre optionnel (`?`). Les paramètres avec valeur par défaut, eux, peuvent techniquement être placés avant (on passe alors `undefined` explicitement), mais c'est rarement une bonne idée.
[doc]: Handbook — Paramètres optionnels | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### À quoi sert le paramètre `this` dans cette signature ?
```ts
function onClick(this: HTMLButtonElement, e: MouseEvent) {}
```
- [ ] C'est le premier argument à passer lors de l'appel
- [x] Il type le contexte `this` de la fonction ; il est effacé à la compilation
- [ ] Il lie automatiquement la fonction au bouton
- [ ] Il est interdit en mode strict
> `this` en premier paramètre est un **pseudo-paramètre** : il ne compte pas dans les arguments et sert uniquement à typer `this`. Il ne fait aucun `bind`.
[doc]: Handbook — Déclarer this | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Comment typer un objet dont les clés sont des chaînes arbitraires et les valeurs des nombres ?
- [x] `Record<string, number>`
- [ ] `Object<number>`
- [ ] `{ string: number }`
- [ ] `Map<number>`
> `Record<string, number>` équivaut à `{ [key: string]: number }`. `{ string: number }` décrit un objet avec **une** propriété littéralement nommée `string`. `Map` est une structure différente (avec `get`/`set`) et prend deux paramètres de type.
[doc]: Handbook — Signatures d'index | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Pourquoi annoter explicitement le type de retour des fonctions exportées ?
- [ ] C'est obligatoire en mode strict
- [ ] Cela améliore les performances à l'exécution
- [x] Cela fige le contrat public : une modification interne ne change pas silencieusement le type exposé, et l'erreur apparaît dans la fonction plutôt que chez les appelants
- [ ] Sinon le type de retour est `any`
> L'inférence est fiable, mais sur une API publique, un `return` oublié ou modifié changerait le type inféré et casserait les appelants loin de la cause. L'annotation sert aussi de documentation et accélère le type-checking sur les gros projets (`isolatedDeclarations`).
[doc]: Handbook — Annotations de type de retour | https://www.typescriptlang.org/fr/docs/handbook/2/everyday-types.html

### Quelle syntaxe décrit un type « fonction qui prend une chaîne et ne retourne rien » ?
- [ ] `type Fn = function(string): void`
- [x] `type Fn = (message: string) => void`
- [ ] `type Fn = string => void`
- [ ] `type Fn = (string) => void`
> Le nom du paramètre est **obligatoire** dans un type fonction. Piège : `(string) => void` est valide mais déclare un paramètre *nommé* `string` de type `any` (erreur avec `noImplicitAny`).
[doc]: Handbook — Function type expressions | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quelle est la différence entre `extends` sur une interface et `&` sur un type ?
- [ ] Aucune, c'est purement syntaxique
- [x] `extends` signale immédiatement une propriété incompatible ; `&` crée silencieusement une propriété `never`
- [ ] `&` ne fonctionne qu'avec des primitifs
- [ ] `extends` copie les valeurs à l'exécution
> `interface B extends A` vérifie que `B` est compatible avec `A` et produit une erreur claire en cas de conflit. Une intersection combine sans vérifier, et un conflit donne `never`. Les interfaces sont aussi mises en cache par le compilateur, ce qui est plus performant sur les grosses bases.
[doc]: Handbook — Étendre des types | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Que décrit cette interface ?
```ts
interface Factory { new (nom: string): Service }
```
- [ ] Une méthode nommée `new`
- [x] Une signature de construction : une valeur qu'on peut appeler avec `new`
- [ ] Un service singleton
- [ ] Une erreur de syntaxe
> Une *construct signature* décrit un constructeur. C'est utile pour typer des fabriques ou des paramètres comme `Type<T>` dans NestJS (`new (...args: any[]) => T`).
[doc]: Handbook — Construct signatures | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Comment ajouter une propriété `user` à l'objet `Request` d'Express, de façon typée, dans tout le projet ?
- [ ] Modifier le fichier dans `node_modules/@types/express`
- [ ] `type Request = Request & { user: User }`
- [x] Utiliser la fusion de déclarations : `declare global { namespace Express { interface Request { user?: User } } }`
- [ ] Caster `req as any` partout
> L'augmentation de module (*module augmentation*) repose sur la fusion des interfaces. C'est exactement ce que fait `@types/passport` pour ajouter `req.user`.
[doc]: Module augmentation (EN) | https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation

### Quelles affirmations sur les paramètres sont vraies ? (plusieurs réponses)
- [x] Un paramètre avec valeur par défaut est optionnel pour l'appelant
- [x] Un paramètre rest (`...args`) doit être le dernier
- [ ] Un paramètre optionnel vaut `null` s'il n'est pas fourni
- [ ] On peut avoir plusieurs paramètres rest
> Un paramètre non fourni vaut `undefined` (pas `null`). Il ne peut y avoir qu'un seul paramètre rest, en dernière position.
[doc]: Handbook — Paramètres rest | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html
