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

### Ce code compile-t-il ?
```ts
function formater(x: string): string;
function formater(x: number): string;
function formater(x: string | number): string {
  return String(x);
}
declare const v: string | number;
formater(v);
```
- [ ] Oui, la signature d'implémentation accepte `string | number`
- [x] Non : aucune surcharge publique n'accepte `string | number`
- [ ] Oui, TS choisit la première surcharge
- [ ] Non, une surcharge doit avoir un corps
> La signature d'**implémentation** n'est pas visible de l'extérieur : seules les surcharges le sont, et TS en cherche une seule qui accepte l'argument. Ici, une simple signature `(x: string | number): string` serait plus simple et plus utile — préférez une union aux surcharges quand c'est possible.
[doc]: Handbook — Surcharges de fonctions | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Quelle est la différence entre `{ a?: string }` et `{ a: string | undefined }` ?
- [ ] Aucune
- [x] Avec la seconde, la propriété `a` doit être présente (même si elle vaut `undefined`)
- [ ] La première interdit `undefined`
- [ ] La seconde est refusée en mode `strict`
> `{}` est assignable à `{ a?: string }` mais pas à `{ a: string | undefined }`, où la clé est obligatoire. L'option `exactOptionalPropertyTypes` va plus loin : elle interdit d'écrire explicitement `a: undefined` sur une propriété `a?: string`.
[doc]: tsconfig — exactOptionalPropertyTypes | https://www.typescriptlang.org/fr/tsconfig#exactOptionalPropertyTypes

### Ce code compile-t-il ?
```ts
interface Commande {
  readonly client: { nom: string };
}
declare const c: Commande;
c.client.nom = 'Alice';
```
- [x] Oui : `readonly` est superficiel, il protège seulement la propriété `client`
- [ ] Non : tout l'objet est en lecture seule
- [ ] Non, mais uniquement en mode `strict`
- [ ] Oui, mais lève une erreur à l'exécution
> `readonly` empêche `c.client = …` mais pas la mutation des objets imbriqués. Pour une immuabilité profonde, il faut un type récursif (`DeepReadonly<T>`) — et rien de tout cela n'existe à l'exécution.
[doc]: Handbook — Propriétés readonly | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Pourquoi cet appel ne compile-t-il pas ?
```ts
const args = [8, 5];
const angle = Math.atan2(...args);
```
- [ ] `Math.atan2` n'accepte pas de spread
- [x] `args` est inféré `number[]` : TS ne sait pas qu'il contient exactement deux éléments
- [ ] Il faut écrire `Math.atan2.apply(args)`
- [ ] Il compile sans erreur
> Un spread doit cibler un paramètre rest ou avoir un **type tuple**. `number[]` peut avoir 0 ou 50 éléments. Avec `const args = [8, 5] as const`, le type devient `readonly [8, 5]` et l'appel compile.
[doc]: Handbook — Rest arguments | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Pourquoi cette interface est-elle refusée ?
```ts
interface Dictionnaire {
  [cle: string]: number;
  nom: string;
}
```
- [ ] On ne peut pas combiner signature d'index et propriétés nommées
- [x] Toutes les propriétés nommées doivent respecter le type de la signature d'index (`number`)
- [ ] Il manque `readonly` devant la signature d'index
- [ ] La clé d'une signature d'index doit être `number`
> Avec `[cle: string]: number`, **toute** clé chaîne doit renvoyer un `number`, y compris `nom`. Solution : élargir la signature (`number | string`) ou séparer les données (`{ nom: string; valeurs: Record<string, number> }`).
[doc]: Handbook — Index signatures | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Que fait réellement ce paramètre ?
```ts
function afficher({ titre: string }) {
  console.log(string);
}
```
- [ ] Il déstructure `titre` et l'annote en `string`
- [x] Il déstructure `titre` et le renomme en une variable appelée `string`
- [ ] Il déclare un paramètre optionnel
- [ ] C'est une erreur de syntaxe
> Dans un motif de déstructuration, `{ a: b }` **renomme** `a` en `b`. L'annotation de type se place après le motif : `function afficher({ titre }: { titre: string })`. Avec `noImplicitAny`, le code d'origine est signalé car `string` est implicitement `any`.
[doc]: Handbook — Déstructuration de paramètres | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Ce code compile-t-il ?
```ts
const scores: Record<'alice' | 'bob', number> = { alice: 12 };
```
- [ ] Oui, les clés de `Record` sont optionnelles
- [x] Non : la clé `bob` est manquante
- [ ] Oui, mais `scores.bob` vaut `0`
- [ ] Non : `Record` n'accepte que `string` comme clé
> `Record<K, V>` avec une union de littéraux exige **toutes** les clés. Pour des clés facultatives : `Partial<Record<'alice' | 'bob', number>>`. Avec `Record<string, number>`, en revanche, aucune clé n'est imposée.
[doc]: Handbook — Record | https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type

### Pourquoi peut-on passer `(x) => console.log(x)` à `forEach`, dont le callback reçoit `(value, index, array)` ?
- [ ] Parce que `forEach` est typé avec `any`
- [x] Parce qu'une fonction qui ignore des paramètres est assignable à un type fonction qui en déclare davantage
- [ ] Parce que les paramètres manquants sont optionnels par défaut
- [ ] Ce n'est autorisé qu'avec `strict: false`
> En JavaScript, ignorer des arguments supplémentaires est sans danger : TS accepte donc une fonction avec **moins** de paramètres. L'inverse (exiger plus de paramètres que l'appelant n'en fournit) est refusé. C'est pourquoi il ne faut pas déclarer un paramètre optionnel dans un type de callback « au cas où ».
[doc]: Handbook — Paramètres optionnels dans les callbacks | https://www.typescriptlang.org/fr/docs/handbook/2/functions.html

### Qu'affiche ce code ?
```ts
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 1);
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 1);
}
```
- [ ] `0 1 2` puis `0 1 2`
- [ ] `0 1 2` puis `3 3 3`
- [x] `3 3 3` puis `0 1 2`
- [ ] `3 3 3` puis `3 3 3`
> Les callbacks s'exécutent **après** la fin des boucles. Avec `var`, il n'existe qu'une seule variable `i` pour toute la fonction : les trois closures lisent sa valeur finale, `3`. Avec `let`, chaque itération crée une **nouvelle liaison** `j`, et chaque closure capture la sienne.
[doc]: MDN — Closures | https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Closures

### Dans un module ES (fichier avec `import`/`export`), que se passe-t-il ?
```ts
const forme = {
  rayon: 10,
  diametre() { return this.rayon * 2; },
  perimetre: () => 2 * Math.PI * this.rayon,
};
forme.diametre();
forme.perimetre();
```
- [ ] `20`, puis `62.83…`
- [x] `20`, puis une `TypeError` : `this` vaut `undefined`
- [ ] `NaN`, puis `62.83…`
- [ ] `20`, puis `undefined`
> Une méthode classique reçoit `this` de l'appel (`forme.diametre()` → `this === forme`). Une fonction fléchée n'a **pas de `this` propre** : elle capture celui du code qui l'entoure, ici le niveau du module, où `this` vaut `undefined`. Dans un script non-module, ce serait l'objet global, et le résultat serait `NaN`. TS signale l'erreur à la compilation (*Object is possibly 'undefined'*). Règle : pas de fonction fléchée pour une méthode qui utilise `this`.
[doc]: MDN — Fonctions fléchées | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Functions/Arrow_functions

### Que reçoit `info` en arguments ?
```ts
function info(chaines: TemplateStringsArray, nom: string, age: number) {
  console.log(chaines, nom, age);
}
info`${'Lydia'} a ${21} ans`;
```
- [ ] `'Lydia'`, `21`, `['', ' a ', ' ans']`
- [x] `['', ' a ', ' ans']`, `'Lydia'`, `21`
- [ ] `'Lydia a 21 ans'`, `undefined`, `undefined`
- [ ] `['Lydia', 21]`, `undefined`, `undefined`
> Avec un **gabarit étiqueté** (*tagged template*), le premier argument est le tableau des morceaux de texte fixes (il y en a toujours un de plus que d'expressions, d'où les chaînes vides), puis viennent les valeurs des expressions. C'est le mécanisme utilisé par `` sql`…` `` (requêtes paramétrées, sans injection SQL), `styled-components` ou `graphql-tag`.
[doc]: MDN — Littéraux de gabarits | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Template_literals

### Qu'affiche ce code ?
```ts
function dire(this: { nom: string }, age: number) {
  return `${this.nom} a ${age} ans`;
}
const lydia = { nom: 'Lydia' };
console.log(dire.call(lydia, 21));
console.log(typeof dire.bind(lydia, 21));
```
- [ ] `Lydia a 21 ans` puis `Lydia a 21 ans`
- [x] `Lydia a 21 ans` puis `function`
- [ ] `undefined a 21 ans` puis `function`
- [ ] `function` puis `function`
> `call` (et `apply`, qui prend un tableau d'arguments) **appelle immédiatement** la fonction avec le `this` donné. `bind` ne l'appelle pas : il renvoie une **nouvelle fonction** dont le `this` (et ici le premier argument) est fixé. Le paramètre `this:` de la signature n'existe que pour TS, qui vérifie ainsi que chaque appel fournit le bon contexte.
[doc]: MDN — Function.prototype.call | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Function/call
[doc]: MDN — Function.prototype.bind | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Function/bind

### Que renvoie cette expression ?
```ts
[[0, 1], [2, 3]].reduce((acc, cur) => acc.concat(cur), [1, 2]);
```
- [ ] `[0, 1, 2, 3, 1, 2]`
- [ ] `[6, 1, 2]`
- [x] `[1, 2, 0, 1, 2, 3]`
- [ ] `[1, 2, 6]`
> La valeur initiale `[1, 2]` est le premier `acc`. Tour 1 : `[1, 2].concat([0, 1])` donne `[1, 2, 0, 1]`. Tour 2 : on y concatène `[2, 3]`. Pour aplatir un tableau, `arr.flat()` est plus lisible.
[doc]: MDN — Array.prototype.reduce | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce

### Qu'affiche ce code ?
```ts
function saluer(): string {
  throw 'Hello world!';
}
try {
  const data = saluer();
  console.log('Ça marche', data);
} catch (e) {
  console.log('Erreur :', e);
}
```
- [ ] `Ça marche Hello world!`
- [x] `Erreur : Hello world!`
- [ ] `Erreur : undefined`
- [ ] `SyntaxError` : on ne peut lancer que des objets `Error`
> On peut lancer **n'importe quelle valeur** : une chaîne, un nombre, un objet… C'est pour cela que TS type `e` en `unknown` dans un `catch`. Lancer une chaîne est une mauvaise pratique : on perd la pile d'appels (*stack trace*) et `e instanceof Error` est faux. Il vaut mieux toujours faire `throw new Error('…')`, ou utiliser une sous-classe d'`Error`.
[doc]: MDN — throw | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/throw

### Qu'affiche ce code ?
```ts
const reglages = { utilisateur: 'lydia', niveau: 19, sante: 90 };
console.log(JSON.stringify(reglages, ['niveau', 'sante']));
```
- [x] `{"niveau":19,"sante":90}`
- [ ] `{"utilisateur":"lydia"}`
- [ ] `["niveau","sante"]`
- [ ] `{"utilisateur":"lydia","niveau":19,"sante":90}`
> Le deuxième argument de `JSON.stringify` est un *replacer*. Un **tableau** sert de liste blanche des clés à sérialiser. Une **fonction** `(cle, valeur) => …` permet de transformer ou masquer des valeurs, par exemple pour retirer un mot de passe d'un log. Le troisième argument indente le résultat (`JSON.stringify(x, null, 2)`).
[doc]: MDN — JSON.stringify | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify

### Qu'affiche ce code ?
```ts
const valeur = { nombre: 10 };
const multiplier = (x = { ...valeur }) => {
  console.log((x.nombre *= 2));
};
multiplier();
multiplier();
multiplier(valeur);
multiplier(valeur);
```
- [ ] `20 40 80 160`
- [ ] `20 40 20 40`
- [x] `20 20 20 40`
- [ ] `NaN NaN 20 40`
> Une valeur par défaut est **évaluée à chaque appel** (contrairement à Python) : les deux premiers appels reçoivent chacun une nouvelle copie `{ nombre: 10 }`, et affichent `20`. Les deux suivants reçoivent l'objet `valeur` lui-même et le **modifient** : `20`, puis `40`. Une copie par spread est **superficielle** : elle ne protège pas les objets imbriqués (`structuredClone` pour une copie profonde).
[doc]: MDN — Valeurs par défaut des arguments | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Functions/Default_parameters
