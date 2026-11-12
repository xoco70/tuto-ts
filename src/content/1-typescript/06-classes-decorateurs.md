---
id: ts-classes
track: typescript
order: 6
title: Classes, enums et décorateurs
level: Intermédiaire
summary: Modificateurs d'accès, propriétés de paramètre, classes abstraites, enums vs unions, décorateurs et métadonnées (la base de NestJS).
---

## Classes et modificateurs

```ts
class Compte {
  static readonly DEVISE = 'EUR';
  #pin: string;                      // champ privé JavaScript (vrai privé au runtime)

  constructor(
    public readonly id: string,      // propriété de paramètre : déclare + assigne
    private solde: number,           // private TypeScript (contrôle statique seulement)
    protected titulaire: string,
  ) {
    this.#pin = '0000';
  }

  get soldeFormate(): string { return `${this.solde} ${Compte.DEVISE}`; }
}
```

| Modificateur | Accessible depuis | Au runtime |
| --- | --- | --- |
| `public` (défaut) | partout | — |
| `protected` | la classe et ses sous-classes | rien (effacé) |
| `private` | la classe seulement | rien : `(obj as any).solde` marche |
| `#champ` | la classe seulement | **vraiment privé** (ECMAScript) |

Les **propriétés de paramètre** (`constructor(private readonly repo: UserRepository)`) sont omniprésentes en NestJS : c'est l'injection par constructeur.

`strictPropertyInitialization` exige que chaque propriété soit initialisée dans le constructeur. `nom!: string` (*definite assignment*) désactive ce contrôle — c'est ce qu'on voit dans les entités TypeORM.

## Classes abstraites et interfaces

```ts
interface Notifier { envoyer(msg: string): Promise<void> }

abstract class BaseNotifier implements Notifier {
  abstract envoyer(msg: string): Promise<void>;
  protected formater(msg: string) { return `[${new Date().toISOString()}] ${msg}`; }
}

class EmailNotifier extends BaseNotifier {
  async envoyer(msg: string) { /* ... */ }
}
```

- `implements` **vérifie** que la classe respecte l'interface, il n'ajoute rien.
- Une classe abstraite **existe au runtime** : en NestJS, elle peut servir de **token d'injection** (une interface, non).

## Enums

```ts
enum Statut { Actif = 'ACTIF', Suspendu = 'SUSPENDU' }   // enum de chaînes
enum Direction { Haut, Bas }                             // numérique : 0, 1 (+ reverse mapping)
const enum Taille { S = 'S', M = 'M' }                   // inliné à la compilation
```

- Les enums **génèrent du code** JavaScript (un objet), contrairement aux types.
- Les enums numériques ont un *reverse mapping* (`Direction[0] === 'Haut'`).
- Alternative moderne, souvent préférée : une **union de littéraux** + un objet `as const`.

```ts
const Statut = { Actif: 'ACTIF', Suspendu: 'SUSPENDU' } as const;
type Statut = (typeof Statut)[keyof typeof Statut];   // 'ACTIF' | 'SUSPENDU'
```

`erasableSyntaxOnly` (TS 5.8) et l'exécution native de TS par Node (*type stripping*) **interdisent** les enums, les `namespace` avec code et les propriétés de paramètre — une tendance de fond à connaître.

## Décorateurs

Un décorateur est une **fonction** appliquée à une classe, une méthode, une propriété ou un paramètre au moment de la **définition** de la classe.

```ts
function Log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    console.log(`${key}(${JSON.stringify(args)})`);
    return original.apply(this, args);
  };
}

class Service {
  @Log
  calculer(a: number) { return a * 2; }
}
```

Deux versions coexistent :
- **Décorateurs « legacy »** (`experimentalDecorators: true`) : ceux de **NestJS**, TypeORM, class-validator. Ils supportent les décorateurs de **paramètres** (`@Body()`, `@Inject()`).
- **Décorateurs standard** (TC39, TS 5.0) : nouvelle signature `(value, context)`, pas de décorateurs de paramètres.

### Métadonnées et `emitDecoratorMetadata`

Avec `emitDecoratorMetadata: true` et `reflect-metadata`, TS émet le **type des paramètres du constructeur** (`design:paramtypes`). C'est ainsi que Nest sait quoi injecter dans `constructor(private users: UsersService)` sans `@Inject` : il lit les métadonnées et trouve la classe `UsersService`.

Conséquence : si le paramètre est typé par une **interface** ou un `type`, la métadonnée émise est `Object` → Nest ne peut pas résoudre la dépendance → il faut un **token** + `@Inject(TOKEN)`.

### Ordre d'évaluation

Plusieurs décorateurs sur un même élément sont **évalués de haut en bas** (les fabriques `@A()`) mais **appliqués de bas en haut** (composition `A(B(cible))`).

<!-- QUIZ -->

### Que fait ce constructeur ?
```ts
class UsersService {
  constructor(private readonly repo: UsersRepository) {}
}
```
- [ ] Il déclare un paramètre local `repo` inaccessible ailleurs
- [x] Il déclare une propriété `repo` privée et en lecture seule, et l'assigne avec l'argument
- [ ] Il crée une nouvelle instance de `UsersRepository`
- [ ] Il est invalide sans corps
> C'est une **propriété de paramètre** : le modificateur (`private`, `public`, `readonly`…) transforme le paramètre en propriété de la classe. C'est la forme standard de l'injection de dépendances en NestJS et Angular.
[doc]: Handbook — Parameter properties | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Quelle est la différence entre `private secret` et `#secret` ?
- [ ] Aucune
- [x] `private` n'est vérifié qu'à la compilation ; `#secret` est un champ privé JavaScript, inaccessible même au runtime
- [ ] `#secret` est un commentaire
- [ ] `private` est plus strict que `#secret`
> `private` disparaît à la compilation : `(obj as any).secret` ou `obj['secret']` y accèdent. Les champs `#` sont garantis par le moteur JS (une `TypeError` si on y accède hors de la classe).
[doc]: Handbook — private vs # | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Pourquoi les entités TypeORM utilisent-elles souvent `nom!: string` ?
- [ ] Pour rendre le champ obligatoire en base
- [x] Pour désactiver `strictPropertyInitialization` sur ce champ, car l'ORM l'assigne lui-même
- [ ] Pour le rendre non-nullable à l'exécution
- [ ] Pour l'exclure de la sérialisation
> La *definite assignment assertion* (`!`) dit au compilateur « cette propriété sera initialisée, même si tu ne le vois pas ». L'ORM hydrate l'instance sans passer par un constructeur qui initialiserait les champs.
[doc]: Handbook — Definite assignment | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Que génère `enum Direction { Haut, Bas }` dans le JavaScript compilé ?
- [ ] Rien, comme pour un type
- [x] Un objet avec un mapping dans les deux sens : `Direction.Haut === 0` et `Direction[0] === 'Haut'`
- [ ] Une classe `Direction`
- [ ] Une union `'Haut' | 'Bas'`
> Les enums **numériques** génèrent un objet avec *reverse mapping*. Les enums de chaînes génèrent un objet sans reverse mapping. Les `const enum` sont inlinés (et posent problème avec `isolatedModules`).
[doc]: Enums (EN) | https://www.typescriptlang.org/docs/handbook/enums.html

### Quelle alternative aux enums est souvent recommandée aujourd'hui ?
- [ ] `namespace`
- [x] Un objet `as const` et une union de littéraux dérivée
- [ ] Une classe avec des propriétés statiques
- [ ] `Symbol`
> `const S = { A: 'A' } as const; type S = (typeof S)[keyof typeof S]` : zéro surprise, compatible avec le *type stripping* (Node, `erasableSyntaxOnly`), et les littéraux bruts (`'A'`) sont acceptés. Les enums restent fréquents dans les codebases NestJS/TypeORM.
[doc]: Enums — Objects vs Enums (EN) | https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums

### Comment NestJS sait-il quoi injecter dans `constructor(private users: UsersService)` sans `@Inject()` ?
- [ ] Il analyse le code source au démarrage
- [x] TS émet le type des paramètres en métadonnées (`design:paramtypes`) grâce à `emitDecoratorMetadata`, et Nest les lit via `reflect-metadata`
- [ ] Il devine d'après le nom du paramètre
- [ ] Il utilise les interfaces TypeScript au runtime
> Avec `emitDecoratorMetadata`, toute classe décorée (ici `@Injectable()`) reçoit les constructeurs de ses paramètres en métadonnées. Comme il faut une **valeur**, cela ne fonctionne qu'avec des **classes**.
[doc]: Decorators — Metadata (EN) | https://www.typescriptlang.org/docs/handbook/decorators.html#metadata

### Pourquoi `constructor(private notifier: Notifier)` échoue-t-il en NestJS si `Notifier` est une interface ?
- [ ] Les interfaces ne peuvent pas avoir de méthodes
- [x] L'interface est effacée : la métadonnée émise est `Object`, Nest ne peut pas résoudre le provider. Il faut un token et `@Inject(NOTIFIER)`
- [ ] Il faut ajouter `implements` dans le constructeur
- [ ] Les interfaces doivent être exportées
> Solutions : un token (`Symbol` ou chaîne) + `@Inject(TOKEN)`, ou une **classe abstraite** comme token (elle existe au runtime). Question très fréquente en entretien NestJS.
[doc]: NestJS — Custom providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers

### Dans quel ordre sont appliqués ces décorateurs ?
```ts
class C {
  @A()
  @B()
  m() {}
}
```
- [ ] `A` puis `B`
- [x] Les fabriques sont évaluées `A()` puis `B()`, mais les décorateurs sont appliqués `B` puis `A`
- [ ] `B` puis `A`, fabriques comprises
- [ ] L'ordre est indéterminé
> Comme une composition de fonctions `A(B(m))` : les expressions sont évaluées de haut en bas, l'application se fait de bas en haut.
[doc]: Decorators — Composition (EN) | https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-composition

### Quelle différence majeure entre les décorateurs « legacy » (`experimentalDecorators`) et les décorateurs standard TC39 de TS 5.0 ?
- [ ] Les standard ne fonctionnent que sur les fonctions
- [x] Les standard ne supportent pas les décorateurs de paramètres et n'émettent pas `design:paramtypes`
- [ ] Les legacy sont plus rapides
- [ ] Il n'y a aucune différence
> NestJS repose sur les décorateurs de paramètres (`@Body()`, `@Param()`, `@Inject()`) et sur les métadonnées de types : il utilise donc toujours `experimentalDecorators` + `emitDecoratorMetadata`.
[doc]: Release notes TS 5.0 — Decorators (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators

### Que vérifie `class EmailNotifier implements Notifier` ?
- [ ] Il hérite des méthodes de `Notifier`
- [x] Il vérifie que la classe possède les membres de `Notifier`, sans rien ajouter au JS généré
- [ ] Il enregistre la classe comme provider de `Notifier`
- [ ] Il rend les méthodes abstraites
> `implements` est un pur contrôle statique. Il ne fournit ni implémentation, ni type contextuel aux paramètres des méthodes (il faut les annoter).
[doc]: Handbook — implements | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Quelle affirmation sur les classes abstraites est fausse ?
- [ ] Elles ne peuvent pas être instanciées directement
- [ ] Elles peuvent contenir des méthodes implémentées
- [x] Elles sont effacées à la compilation comme les interfaces
- [ ] Elles peuvent servir de token d'injection en NestJS
> Une classe abstraite est une vraie classe JavaScript : elle existe au runtime. `abstract` n'est vérifié que par TS. C'est ce qui permet de l'utiliser comme token d'injection.
[doc]: Handbook — Abstract classes | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Quel accès est autorisé pour un membre `protected` ?
- [ ] Uniquement depuis la classe qui le déclare
- [x] Depuis la classe et ses sous-classes
- [ ] Depuis tout le module
- [ ] Depuis partout en lecture seule
> `protected` autorise les sous-classes, `private` non. Une sous-classe peut même rendre `public` un membre `protected` en le redéclarant.
[doc]: Handbook — Member visibility | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Pourquoi perd-on `this` dans ce code et comment le corriger ?
```ts
class Compteur {
  n = 0;
  inc() { this.n++; }
}
const c = new Compteur();
setTimeout(c.inc, 10);
```
- [ ] Ce code fonctionne
- [x] La méthode est passée détachée : `this` est `undefined`. Corriger avec une fonction fléchée en propriété (`inc = () => {...}`) ou `c.inc.bind(c)`
- [ ] Il faut déclarer `n` en `static`
- [ ] `setTimeout` n'accepte pas les méthodes
> En JS, `this` dépend de l'**appel**, pas de la définition. Une propriété fléchée capture `this` lexicalement (mais crée une fonction par instance et n'est pas sur le prototype).
[doc]: MDN — this | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/this

### Avec `erasableSyntaxOnly` (TS 5.8), lesquelles de ces syntaxes sont interdites ? (plusieurs réponses)
- [x] `enum Couleur { Rouge }`
- [x] `constructor(private repo: Repo) {}`
- [ ] `type Id = string`
- [ ] `interface User { id: string }`
> Cette option n'autorise que la syntaxe qui peut être **simplement effacée** (ce que fait Node.js avec son *type stripping*, activé par défaut depuis Node 23.6). Les enums, `namespace` avec code et propriétés de paramètre génèrent du JS : interdits.
[doc]: Release notes TS 5.8 — erasableSyntaxOnly (EN) | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html

### Ce code compile-t-il ?
```ts
class A { private x = 1 }
class B { private x = 1 }
const a: A = new B();
```
- [ ] Oui, le typage est structurel et les formes sont identiques
- [x] Non : des membres `private` (ou `protected`) rendent les classes incompatibles entre elles
- [ ] Oui, mais `a.x` n'est pas accessible
- [ ] Non, car il faut `implements A`
> Sans membre privé, deux classes de même forme sont interchangeables. Un membre `private` ne compte comme compatible que s'il provient de la **même déclaration** : c'est une façon d'obtenir un typage quasi nominal.
[doc]: Handbook — Classes (compatibilité) | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Avec `noImplicitOverride`, que protège le mot-clé `override` ?
- [ ] Il empêche une sous-classe de redéfinir la méthode
- [x] Il signale une erreur si la méthode parente n'existe pas (faute de frappe, renommage)
- [ ] Il appelle automatiquement `super.methode()`
- [ ] Il rend la méthode abstraite
> Avec `noImplicitOverride`, toute redéfinition doit être marquée `override`, et `override` sur une méthode absente du parent est une erreur. Si quelqu'un renomme la méthode dans la classe de base, les sous-classes cassent à la compilation au lieu de devenir silencieusement des méthodes orphelines.
[doc]: tsconfig — noImplicitOverride | https://www.typescriptlang.org/fr/tsconfig#noImplicitOverride

### Que se passe-t-il à la dernière ligne ?
```ts
class Personne {
  constructor(private prenom: string, private nom: string) {}
  get complet() { return `${this.prenom} ${this.nom}`; }
}
new Personne('Ada', 'Lovelace').complet = 'X';
```
- [ ] La valeur est remplacée
- [x] Erreur de compilation : une propriété avec seulement un `get` est en lecture seule
- [ ] Le getter est remplacé par une propriété
- [ ] Rien, l'affectation est ignorée silencieusement
> TS infère `readonly` pour un accesseur sans `set`. Pour autoriser l'écriture, il faut déclarer un `set complet(valeur: string)`.
[doc]: Handbook — Getters / Setters | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Qu'est-ce qu'une « fabrique de décorateur » comme `@Get(':id')` ?
- [ ] Un décorateur appliqué au moment de l'appel HTTP
- [x] Une fonction qui reçoit des paramètres et **retourne** le décorateur à appliquer
- [ ] Un décorateur qui crée une nouvelle classe
- [ ] Une syntaxe réservée à NestJS
> `@Get(':id')` appelle d'abord `Get(':id')`, qui renvoie la vraie fonction décorateur. C'est pourquoi on écrit `@Injectable()` avec des parenthèses : `Injectable` est une fabrique, l'oublier lève une erreur ou ne fait rien.
[doc]: Handbook — Decorator factories | https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-factories

### Quelle déclaration est invalide ?
- [ ] `class A extends Base implements X, Y {}`
- [ ] `class A implements X, Y, Z {}`
- [x] `class A extends Base1, Base2 {}`
- [ ] `interface I extends X, Y {}`
> Une classe n'hérite que d'**une seule** classe (héritage simple de JavaScript), mais peut implémenter plusieurs interfaces. Une interface, elle, peut étendre plusieurs interfaces. Pour combiner des comportements, on préfère la composition (ou les mixins).
[doc]: Handbook — implements | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Pourquoi ce constructeur ne compile-t-il pas ?
```ts
class Admin extends User {
  role: string;
  constructor(nom: string) {
    this.role = 'admin';
    super(nom);
  }
}
```
- [ ] `role` doit être initialisé à la déclaration
- [x] `super()` doit être appelé avant tout accès à `this` dans une classe dérivée
- [ ] Une classe dérivée ne peut pas avoir de constructeur
- [ ] Il faut écrire `super.constructor(nom)`
> C'est une règle de JavaScript : l'instance n'existe qu'après l'appel au constructeur parent. TS le vérifie à la compilation ; JS lèverait une `ReferenceError` à l'exécution.
[doc]: Handbook — Classes dérivées | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Où peut-on affecter une propriété `readonly id: string` d'une classe ?
- [ ] Nulle part, elle doit être initialisée à la déclaration
- [x] À la déclaration ou dans le constructeur
- [ ] Dans n'importe quelle méthode de la classe
- [ ] Uniquement via un setter
> `readonly` interdit toute affectation **après** la construction. C'est une garantie de compilation seulement : rien n'est gelé à l'exécution.
[doc]: Handbook — readonly | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html

### Pourquoi ce code est-il signalé avec `noImplicitAny` ?
```ts
interface Verifiable { verifier(nom: string): boolean }
class Verificateur implements Verifiable {
  verifier(s) {
    return s.toLowerCase() === 'ok';
  }
}
```
- [ ] Parce que `implements` est mal orthographié
- [x] Parce que `implements` ne type pas les paramètres : `s` est implicitement `any`
- [ ] Parce qu'il manque le mot-clé `override`
- [ ] Il n'est pas signalé, `s` est inféré `string`
> `implements` vérifie seulement que la classe est **compatible** avec l'interface ; il ne change pas le type de la classe et ne fournit pas de typage contextuel aux méthodes. Il faut annoter `verifier(s: string)`.
[doc]: Handbook — implements (mises en garde) | https://www.typescriptlang.org/fr/docs/handbook/2/classes.html
