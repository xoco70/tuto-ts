---
id: ts-async
track: typescript
order: 7
title: Asynchrone, Promises et event loop
level: Intermédiaire
summary: Event loop, microtâches vs macrotâches, async/await, Promise.all / allSettled / race, gestion d'erreurs et annulation.
---

## L'event loop en 30 secondes

Node.js et le navigateur exécutent le JS sur **un seul thread**. L'event loop enchaîne :

1. Le code **synchrone** de la pile d'appels jusqu'à ce qu'elle soit vide.
2. **Toutes** les **microtâches** : callbacks de Promises (`then`, suite d'un `await`), `queueMicrotask`. (Dans Node, `process.nextTick` passe même avant.)
3. Une **macrotâche** : `setTimeout`, `setInterval`, I/O, `setImmediate`… puis de nouveau toutes les microtâches.

```ts
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// 1, 4, 3, 2
```

> Un calcul CPU lourd **bloque** tout le serveur Node (aucune autre requête n'est traitée). Solutions : `worker_threads`, découper le travail, ou un service dédié / une queue.

## Promises

```ts
const p = new Promise<number>((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});
p.then((v) => v * 2).catch((e) => console.error(e)).finally(() => {});
```

États : `pending` → `fulfilled` ou `rejected` (définitivement, *settled*).

## async / await

```ts
async function chargerUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<User>;
}
```

- Une fonction `async` **retourne toujours une Promise** ; un `throw` devient un rejet.
- `await` suspend la fonction (pas le thread) jusqu'au règlement de la promesse.
- `return await` dans un `try` est nécessaire pour que le `catch` local attrape le rejet.

## Séquentiel vs parallèle

```ts
// ❌ séquentiel : ~300 ms
const a = await getA();   // 100 ms
const b = await getB();   // 200 ms

// ✅ parallèle : ~200 ms
const [a2, b2] = await Promise.all([getA(), getB()]);
```

| Combinateur | Résout quand | Rejette quand |
| --- | --- | --- |
| `Promise.all` | toutes réussissent (tableau ordonné) | **la première** échoue (les autres continuent quand même !) |
| `Promise.allSettled` | toutes sont réglées (`{status, value/reason}`) | jamais |
| `Promise.race` | la première réglée (succès ou échec) | idem |
| `Promise.any` | la première **réussie** | toutes échouent (`AggregateError`) |

`await` dans une boucle `for...of` = séquentiel (parfois voulu : rate limit, ordre). `arr.forEach(async ...)` **n'attend rien** : bug classique.

Pour limiter la concurrence (ex. 5 requêtes simultanées), on utilise un pool (`p-limit`) ou des lots.

## Gestion d'erreurs

```ts
try {
  await traiter();
} catch (e: unknown) {
  if (e instanceof HttpError) { ... }
  throw e;   // ne jamais avaler silencieusement
}
```

Une promesse rejetée **sans handler** déclenche `unhandledRejection` ; depuis Node 15, cela **arrête le processus** par défaut.

## Annulation et timeouts

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
await fetch(url, { signal: controller.signal });
// ou plus simple : fetch(url, { signal: AbortSignal.timeout(5000) })
```

Une Promise ne s'annule pas : on annule l'**opération sous-jacente** via un `AbortSignal`. C'est aussi ce qu'utilisent React Query et les `useEffect` propres.

## Typage utile

```ts
type R = Awaited<ReturnType<typeof chargerUser>>;   // User
const results: PromiseSettledResult<User>[] = await Promise.allSettled(ps);
```

<!-- QUIZ -->

### Comment annoter le type de retour d'une fonction `async` qui renvoie un `User` ?
```ts
async function chargerUser(id: string): ??? {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```
- [ ] `User`
- [x] `Promise<User>`
- [ ] `Async<User>`
- [ ] `User | Promise`
> Une fonction `async` renvoie **toujours** une Promise : on annote donc `Promise<User>`, où `User` est le type de la valeur obtenue après `await`. L'appelant écrit `const u = await chargerUser('42')` et récupère un `User`.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: facile

### Ce code compile-t-il ?
```ts
async function compter(): number {
  return 1;
}
```
- [ ] Oui, TS enveloppe le type automatiquement
- [x] Non : le type de retour d'une fonction `async` doit être `Promise<…>`, ici `Promise<number>`
- [ ] Oui, mais uniquement sans `strict`
- [ ] Non : une fonction `async` ne peut pas retourner de nombre
> TS refuse une annotation qui ne serait pas une Promise (erreur TS1064) : l'annotation décrit ce que l'appelant reçoit réellement, c'est-à-dire une Promise. On peut aussi omettre l'annotation : TS infère `Promise<number>`.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: facile

### Quel est le type de `n` ?
```ts
async function main() {
  const n = await Promise.resolve(42);
}
```
- [ ] `Promise<number>`
- [x] `number`
- [ ] `any`
- [ ] `Promise<42>`
> `await` « déballe » la Promise : sur une `Promise<number>`, on obtient un `number`. C'est la même opération que le type utilitaire `Awaited<T>` réalise au niveau des types.
[doc]: MDN — await | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/await
[niveau]: facile

### Que vérifie le paramètre de type `<number>` dans ce code ?
```ts
const p = new Promise<number>((resolve) => {
  setTimeout(() => resolve(42), 100);
});
```
- [ ] Le délai du `setTimeout`
- [x] Le type de la valeur passée à `resolve` : `resolve('42')` serait une erreur
- [ ] Le type de l'erreur passée à `reject`
- [ ] Rien, il est purement décoratif
> `Promise<T>` est générique : `T` est le type de la valeur de résolution. TS contrôle donc les appels à `resolve` et type la suite (`p.then((v) => …)` reçoit un `number`). Le motif de `reject`, lui, n'est pas typé.
[doc]: MDN — Promise | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise
[niveau]: facile

### Quel type de retour donner à une fonction `async` qui ne renvoie rien ?
```ts
async function enregistrer(user: User) {
  await db.save(user);
}
```
- [ ] `void`
- [x] `Promise<void>`
- [ ] `Promise<undefined | null>`
- [ ] `never`
> Même sans `return`, une fonction `async` renvoie une Promise, résolue sans valeur : son type est `Promise<void>`. L'annoter `void` serait refusé, comme tout type qui n'est pas une Promise.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: facile

### Que vaut le type `R` ?
```ts
type R = Awaited<Promise<string>>;
```
- [ ] `Promise<string>`
- [x] `string`
- [ ] `unknown`
- [ ] `void`
> `Awaited<T>` donne le type obtenu après un `await` sur `T`. Combiné à `ReturnType`, il permet de récupérer le résultat d'une fonction async sans le réécrire : `Awaited<ReturnType<typeof chargerUser>>` donne `User`.
[doc]: Utility types — Awaited (EN) | https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype
[niveau]: facile

### Quel est le type de `resultat` ?
```ts
declare function getUser(): Promise<User>;
declare function getPosts(): Promise<Post[]>;
const resultat = await Promise.all([getUser(), getPosts()]);
```
- [ ] `(User | Post[])[]`
- [x] `[User, Post[]]`
- [ ] `Promise<[User, Post[]]>`
- [ ] `any[]`
> Sur un tableau littéral, `Promise.all` est typé comme un **tuple** : chaque position garde son type, dans l'ordre. On peut donc déstructurer sans perdre d'information : `const [user, posts] = await Promise.all([…])`.
[doc]: MDN — Promise.all | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
[niveau]: facile

### Avec `strict`, comment lire proprement le message d'erreur ici ?
```ts
try {
  await traiter();
} catch (e) {
  console.error(/* ??? */);
}
```
- [ ] `e.message`, `e` est typé `Error`
- [x] `e instanceof Error ? e.message : String(e)`
- [ ] `(e as string).message`
- [ ] `e!.message`
> En mode strict, `e` est typé `unknown`, car on peut rejeter n'importe quoi (une chaîne, un objet…). Il faut donc l'**affiner** avant d'accéder à `.message`. C'est valable aussi bien pour une erreur synchrone que pour une Promise rejetée attendue avec `await`.
[doc]: Référence tsconfig — useUnknownInCatchVariables | https://www.typescriptlang.org/fr/tsconfig#useUnknownInCatchVariables
[niveau]: facile

### Quels sont les états possibles d'une Promise ? (plusieurs réponses)
- [x] `pending` (en attente)
- [x] `fulfilled` (tenue)
- [x] `rejected` (rejetée)
- [ ] `cancelled` (annulée)
- [ ] `paused` (en pause)
> Une Promise part de `pending` puis devient **définitivement** `fulfilled` ou `rejected` (on dit alors qu'elle est *settled*). Il n'existe pas d'état « annulée » : pour interrompre une opération, on passe par un `AbortSignal`.
[doc]: MDN — Promise | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise
[niveau]: facile

### Que devient un `throw` à l'intérieur d'une fonction `async` ?
- [ ] Il arrête immédiatement le processus
- [x] Il rejette la Promise renvoyée par la fonction
- [ ] Il est ignoré
- [ ] Il est transformé en `undefined`
> Dans une fonction `async`, `throw x` équivaut à renvoyer une Promise rejetée avec `x`. L'appelant le récupère avec `try { await f() } catch` ou avec `.catch()`.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: facile

### Quel est l'ordre d'affichage ?
```ts
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
```
- [ ] A, B, C, D
- [ ] A, D, B, C
- [x] A, D, C, B
- [ ] A, C, D, B
> Le code synchrone d'abord (A, D), puis **toutes les microtâches** (le `then` → C), puis une macrotâche (`setTimeout` → B). Un `setTimeout(…, 0)` passe toujours après les promesses déjà résolues.
[doc]: MDN — Microtâches | https://developer.mozilla.org/fr/docs/Web/API/HTML_DOM_API/Microtask_guide

### Que retourne une fonction `async` qui fait `return 42` ?
- [ ] `42`
- [x] `Promise<number>` résolue avec `42`
- [ ] `undefined`
- [ ] Une erreur : il faut `return Promise.resolve(42)`
> Une fonction `async` enveloppe toujours sa valeur de retour dans une Promise. Son type de retour doit donc être `Promise<T>`.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: facile

### Combien de temps prend ce code, si `getA` prend 100 ms et `getB` 200 ms ?
```ts
const a = await getA();
const b = await getB();
```
- [ ] ~100 ms
- [ ] ~200 ms
- [x] ~300 ms
- [ ] 0 ms
> Les deux `await` sont **séquentiels** : `getB` n'est appelé qu'après la fin de `getA`. Pour paralléliser des appels indépendants : `await Promise.all([getA(), getB()])` → ~200 ms.
[doc]: MDN — Promise.all | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
[niveau]: facile

### Que se passe-t-il ici ?
```ts
async function envoyerTous(users: User[]) {
  users.forEach(async (u) => { await envoyerMail(u); });
  console.log('terminé');
}
```
- [ ] Les mails sont envoyés un par un, puis « terminé » s'affiche
- [x] « terminé » s'affiche immédiatement, sans attendre les envois, et les erreurs ne sont pas propagées
- [ ] Erreur de compilation
- [ ] `forEach` attend chaque promesse
> `forEach` ignore la valeur de retour du callback (une Promise) : rien n'est attendu, et un rejet devient une `unhandledRejection`. Utiliser `for...of` + `await` (séquentiel) ou `await Promise.all(users.map(envoyerMail))` (parallèle).
[doc]: MDN — Array.prototype.forEach | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach

### Quel combinateur utiliser pour lancer 10 appels et récupérer tous les résultats, même si certains échouent ?
- [ ] `Promise.all`
- [x] `Promise.allSettled`
- [ ] `Promise.race`
- [ ] `Promise.any`
> `allSettled` attend que toutes les promesses soient réglées et renvoie `{ status: 'fulfilled', value }` ou `{ status: 'rejected', reason }` pour chacune. `all` rejette dès le premier échec.
[doc]: MDN — Promise.allSettled | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
[niveau]: facile

### Avec `Promise.all([a(), b(), c()])`, si `b()` rejette immédiatement, que deviennent `a()` et `c()` ?
- [ ] Elles sont annulées automatiquement
- [x] Elles continuent de s'exécuter ; seul le résultat global est rejeté
- [ ] Elles sont rejetées aussi
- [ ] Elles sont mises en pause
> Une Promise n'est **pas annulable** : `Promise.all` rejette avec la première erreur, mais les opérations en cours continuent (et consomment des ressources). Pour vraiment annuler, il faut un `AbortController` partagé.
[doc]: MDN — Promise.all | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

### Quelle est la différence entre `Promise.race` et `Promise.any` ?
- [ ] Aucune
- [x] `race` se règle avec la première promesse réglée (succès **ou** échec) ; `any` avec la première **réussie**
- [ ] `any` attend toutes les promesses
- [ ] `race` ne fonctionne qu'avec deux promesses
> `race` sert typiquement à implémenter un timeout (`race([op, delai(5000).then(() => { throw ... })])`). `any` sert à prendre la réponse du premier serveur disponible ; si tout échoue → `AggregateError`.
[doc]: MDN — Promise.any | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/any

### Pourquoi faut-il `return await` ici pour que le `catch` fonctionne ?
```ts
async function f() {
  try {
    return await risque();
  } catch {
    return 'fallback';
  }
}
```
- [ ] Ce n'est pas nécessaire, `return risque()` est équivalent
- [x] Sans `await`, la promesse est retournée telle quelle et son rejet survient après la sortie du `try` : le `catch` local ne l'attrape pas
- [ ] `await` rend l'appel synchrone
- [ ] Pour des raisons de performance
> Dans un `try/catch`, `return await` est indispensable. Hors `try`, `return promise` et `return await promise` sont équivalents (la règle ESLint `return-await` en mode `in-try-catch` formalise cela).
[doc]: MDN — await | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/await
[niveau]: avancé

### Que se passe-t-il par défaut (Node ≥ 15) quand une Promise est rejetée sans handler ?
- [ ] Rien
- [ ] Un warning est affiché, le processus continue
- [x] L'événement `unhandledRejection` est émis et le processus se termine
- [ ] La Promise est réessayée
> Depuis Node 15, `--unhandled-rejections=throw` est le défaut : une promesse rejetée non gérée fait crasher le processus. D'où l'importance de toujours `await` ou `.catch()`, et de la règle ESLint `no-floating-promises`.
[doc]: Node.js — unhandledRejection (EN) | https://nodejs.org/api/process.html#event-unhandledrejection

### Un endpoint Node exécute un calcul CPU de 2 secondes en synchrone. Quel est l'impact ?
- [ ] Seule cette requête est ralentie
- [x] Tout le processus est bloqué : aucune autre requête n'est traitée pendant 2 s
- [ ] Node bascule automatiquement le calcul sur un autre thread
- [ ] Le calcul est interrompu après 1 s
> Le JS s'exécute sur un seul thread : un calcul synchrone monopolise l'event loop. Solutions : `worker_threads`, file de jobs (BullMQ) traitée par des workers, ou découpage avec `setImmediate`.
[doc]: Node.js — Don't block the event loop (EN) | https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
[niveau]: facile

### Comment annuler un `fetch` qui dépasse 5 secondes ?
- [ ] `promise.cancel()`
- [x] `fetch(url, { signal: AbortSignal.timeout(5000) })`
- [ ] `Promise.timeout(fetch(url), 5000)`
- [ ] `clearTimeout(promise)`
> Les Promises ne s'annulent pas : on annule l'opération via un `AbortSignal`. `AbortSignal.timeout(ms)` crée un signal qui s'abandonne automatiquement. Le `fetch` rejette alors avec une `DOMException` (`TimeoutError` ou `AbortError`).
[doc]: MDN — AbortSignal.timeout() | https://developer.mozilla.org/fr/docs/Web/API/AbortSignal/timeout_static

### Dans Node.js, lequel s'exécute en premier ?
```ts
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
```
- [ ] timeout, promise, nextTick
- [ ] promise, nextTick, timeout
- [x] nextTick, promise, timeout
- [ ] nextTick, timeout, promise
> Dans Node, la file `process.nextTick` est vidée **avant** les microtâches des Promises, elles-mêmes avant les macrotâches comme `setTimeout`.
[doc]: Node.js — process.nextTick() (EN) | https://nodejs.org/en/learn/asynchronous-work/understanding-processnexttick
[niveau]: avancé

### Comment traiter 1 000 éléments avec au maximum 5 appels réseau simultanés ?
- [ ] `await Promise.all(items.map(appel))`
- [ ] `for (const i of items) await appel(i)`
- [x] Utiliser un pool de concurrence (ex. `p-limit`) ou traiter par lots de 5 avec `Promise.all`
- [ ] `items.forEach(async (i) => await appel(i))`
> `Promise.all` sur 1 000 éléments lance 1 000 appels d'un coup (risque de rate limit / saturation) ; la boucle `for await` est totalement séquentielle (lent). Un pool garde N appels en vol en permanence.
[doc]: MDN — Utiliser les promesses | https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Using_promises

### Quelles affirmations sur les Promises sont vraies ? (plusieurs réponses)
- [x] Une Promise réglée ne peut plus changer d'état
- [x] Le callback passé à `new Promise(executor)` s'exécute de façon synchrone
- [ ] `then` est exécuté de façon synchrone si la promesse est déjà résolue
- [ ] Une Promise peut être résolue plusieurs fois avec des valeurs différentes
> L'*executor* s'exécute immédiatement, de façon synchrone. En revanche, les callbacks `then/catch` sont **toujours** asynchrones (microtâche), même sur une promesse déjà résolue. Les appels suivants à `resolve`/`reject` sont ignorés.
[doc]: MDN — Promise | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise
[niveau]: avancé

### Quel est l'ordre d'affichage ?
```ts
async function f() {
  console.log('A');
  await null;
  console.log('B');
}
f();
console.log('C');
```
- [ ] A, B, C
- [x] A, C, B
- [ ] C, A, B
- [ ] A, C (B n'est jamais affiché)
> Le corps d'une fonction `async` s'exécute **de façon synchrone** jusqu'au premier `await`. La suite est planifiée en microtâche, exécutée une fois la pile courante vidée — donc après `console.log('C')`.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function
[niveau]: avancé

### Le message « attrapé » est-il affiché ?
```ts
async function charger() {
  throw new Error('boom');
}
try {
  charger();
} catch {
  console.log('attrapé');
}
```
- [ ] Oui, l'erreur est levée immédiatement
- [x] Non : `charger()` retourne une Promise rejetée, le `try/catch` synchrone ne la voit pas
- [ ] Non, car `catch` sans paramètre est invalide
- [ ] Oui, mais seulement en mode strict
> Dans une fonction `async`, un `throw` devient un **rejet** de la Promise retournée. Sans `await charger()` (dans un contexte async) ou `.catch()`, on obtient une *unhandled rejection* — qui fait planter Node ≥ 15.
[doc]: MDN — async function | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/async_function

### À quoi sert `Promise.withResolvers()` (ES2024) ?
- [ ] À résoudre plusieurs Promises en parallèle
- [x] À créer une Promise en récupérant `resolve` et `reject` pour les appeler depuis l'extérieur
- [ ] À annuler une Promise en cours
- [ ] À convertir une fonction callback en Promise
> `const { promise, resolve, reject } = Promise.withResolvers<T>()` remplace le motif où l'on « sortait » `resolve` du constructeur `new Promise`. Utile pour adapter une API à base d'événements (WebSocket, worker…).
[doc]: MDN — Promise.withResolvers | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers

### Comment consommer un flux asynchrone (stream Node, async generator, pagination) élément par élément ?
- [ ] `for (const x of flux)`
- [x] `for await (const x of flux)`
- [ ] `flux.forEach(async (x) => …)`
- [ ] `await Promise.all(flux)`
> `for await...of` itère sur un **itérable asynchrone** en attendant chaque valeur. Les streams Node (`Readable`) sont itérables de cette façon, ce qui permet de traiter un gros fichier sans tout charger en mémoire.
[doc]: MDN — for await...of | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/for-await...of
[niveau]: facile

### Où le `await` de haut niveau (*top-level await*) est-il autorisé ?
- [ ] Partout depuis ES2017
- [x] Uniquement dans les modules ES (pas dans un fichier CommonJS)
- [ ] Uniquement dans les fichiers `.mts`
- [ ] Nulle part, il faut toujours une fonction `async`
> Le top-level await n'existe que dans les **modules ES** : il suspend l'évaluation du module (et de ceux qui l'importent). Côté TS, il faut `module` en `es2022`, `esnext`, `nodenext`… et un fichier traité comme ESM.
[doc]: MDN — await | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/await
[niveau]: avancé

### Quel est le type de `p` ?
```ts
const p = Promise.resolve(1).then((x) => Promise.resolve(x + 1));
```
- [ ] `Promise<Promise<number>>`
- [x] `Promise<number>`
- [ ] `number`
- [ ] `Promise<unknown>`
> Une Promise retournée dans un `.then` est **aplatie** : on ne peut pas obtenir une Promise de Promise. C'est ce qui permet de chaîner des appels asynchrones. L'utilitaire `Awaited<T>` reproduit ce déballage récursif au niveau des types.
[doc]: MDN — Utiliser les promesses (chaînage) | https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Using_promises
[niveau]: avancé

### Quelle valeur la Promise produit-elle ?
```ts
const v = await Promise.resolve(1).finally(() => 2);
```
- [x] `1`
- [ ] `2`
- [ ] `undefined`
- [ ] `[1, 2]`
> `finally` sert au nettoyage (fermer une connexion, cacher un loader) et **ne modifie pas** la valeur transmise. Exception : si le callback lève une erreur ou retourne une Promise rejetée, c'est ce rejet qui l'emporte.
[doc]: MDN — Promise.prototype.finally | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally

### Pourquoi ajouter de l'aléa (*jitter*) à un délai de retry exponentiel ?
- [ ] Pour rendre les tests non déterministes
- [x] Pour éviter que tous les clients en échec réessaient au même instant et saturent à nouveau le service
- [ ] Pour contourner le rate limiting
- [ ] Pour réduire le nombre total de tentatives
> Si 1 000 clients échouent ensemble avec un backoff fixe (1 s, 2 s, 4 s…), ils reviennent ensemble — effet « troupeau ». Un délai aléatoire (`random(0, base * 2 ** tentative)`) étale la charge et laisse le service récupérer.
[doc]: AWS — Exponential backoff and jitter (EN) | https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

### Dans un projet Node avec `@types/node`, pourquoi cette ligne ne compile-t-elle pas, et comment la typer de façon portable ?
```ts
const id: number = setInterval(() => console.log('Hi'), 1000);
```
- [ ] `setInterval` renvoie `void` : il faut garder la fonction pour l'annuler
- [x] Dans Node, `setInterval` renvoie un objet `Timeout`, pas un nombre : on type avec `ReturnType<typeof setInterval>`
- [ ] Il faut écrire `window.setInterval`, qui existe aussi dans Node
- [ ] `setInterval` renvoie une `Promise` : il faut l'attendre avec `await`
> Dans le navigateur, `setInterval` renvoie un identifiant numérique. Dans Node, il renvoie un objet `Timeout` (avec `ref()`, `unref()`, `refresh()`…). Les deux s'annulent avec `clearInterval(id)`. `ReturnType<typeof setInterval>` donne le bon type quel que soit l'environnement, ce qui est utile pour du code partagé entre front et back.
[doc]: MDN — setInterval | https://developer.mozilla.org/fr/docs/Web/API/Window/setInterval
[doc]: Node.js — Timers (EN) | https://nodejs.org/api/timers.html
[niveau]: avancé

### Qu'affiche ce code ?
```ts
function* generateur(i: number) {
  yield i;
  yield i * 2;
}
const gen = generateur(10);
console.log(gen.next().value);
console.log(gen.next().value);
```
- [ ] `[0, 10]` puis `[10, 20]`
- [ ] `20` puis `20`
- [x] `10` puis `20`
- [ ] `undefined` puis `10`
> Appeler un générateur n'exécute rien : on obtient un **itérateur**. Chaque `next()` reprend l'exécution jusqu'au `yield` suivant, et renvoie `{ value, done }`. Un troisième appel renverrait `{ value: undefined, done: true }`. Les générateurs asynchrones (`async function*` + `for await`) reposent sur le même principe pour paginer une API ou lire un flux.
[doc]: MDN — function* | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/function%2A

### Qu'affiche ce code ?
```ts
const p1 = new Promise<string>((res) => setTimeout(res, 500, 'un'));
const p2 = new Promise<string>((res) => setTimeout(res, 100, 'deux'));
Promise.race([p1, p2]).then((r) => console.log(r));
```
- [ ] `un`
- [x] `deux`
- [ ] `deux`, puis `un`
- [ ] `un`, puis `deux`
> `Promise.race` se règle comme la **première** promesse réglée (résolue ou rejetée) : ici `p2`, au bout de 100 ms. `then` ne s'exécute qu'une fois. `p1` continue de tourner mais son résultat est ignoré : `race` n'annule rien (il faut un `AbortController` pour cela). Les arguments après le délai de `setTimeout` sont passés au callback, d'où `res('deux')`.
[doc]: MDN — Promise.race | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
[niveau]: facile
