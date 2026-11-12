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
