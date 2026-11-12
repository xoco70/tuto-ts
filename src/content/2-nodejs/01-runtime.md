---
id: node-runtime
track: nodejs
order: 1
title: Le runtime Node.js — event loop, modules, streams
level: Intermédiaire
summary: Comment Node exécute votre code — V8, libuv, phases de l'event loop, microtâches — puis modules, streams, process, workers et gestion des erreurs.
---

## Ce qu'est Node.js

Node.js = **V8** (le moteur JavaScript de Chrome) + **libuv** (event loop et I/O asynchrones en C) + une **bibliothèque standard** (`node:fs`, `node:http`, `node:crypto`…).

- Votre JavaScript s'exécute sur **un seul thread**.
- Les I/O (réseau, fichiers, DNS, crypto) sont déléguées : au système (epoll, kqueue, IOCP) pour le réseau, au **thread pool de libuv** (4 threads par défaut, `UV_THREADPOOL_SIZE`) pour `fs`, `dns.lookup`, `crypto.pbkdf2`, `zlib`.
- Conséquence : Node encaisse des milliers de connexions simultanées **tant que personne ne bloque le thread principal**.

```ts
// ❌ bloque TOUTES les requêtes pendant le calcul
app.get('/hash', (req, res) => {
  res.send(crypto.pbkdf2Sync(req.query.pwd, 'sel', 1_000_000, 64, 'sha512'));
});

// ✅ délégué au thread pool, le thread principal reste libre
app.get('/hash', async (req, res) => {
  const key = await promisify(crypto.pbkdf2)(req.query.pwd, 'sel', 1_000_000, 64, 'sha512');
  res.send(key);
});
```

## L'event loop

À chaque tour, libuv traverse des **phases**, chacune avec sa file de callbacks :

```
   ┌───────────────────────────┐
┌─>│ timers                    │  setTimeout, setInterval arrivés à échéance
│  ├───────────────────────────┤
│  │ pending callbacks         │  certaines erreurs système différées
│  ├───────────────────────────┤
│  │ poll                      │  attend et traite les I/O (sockets, fichiers)
│  ├───────────────────────────┤
│  │ check                     │  setImmediate
│  ├───────────────────────────┤
└──┤ close callbacks           │  socket.on('close')
   └───────────────────────────┘
```

**Entre chaque callback**, Node vide deux files prioritaires :

1. la file `process.nextTick` ;
2. la file des **microtâches** (promesses résolues, `queueMicrotask`, `await`).

```ts
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
// sync → nextTick → promise → timeout / immediate (ordre non garanti depuis le module principal)
```

Dans un callback d'I/O (`fs.readFile`), `setImmediate` passe **toujours** avant `setTimeout(…, 0)` : la phase *check* suit immédiatement *poll*.

Un `nextTick` ou une microtâche qui se replanifie à l'infini **affame** l'event loop : aucune I/O n'est plus traitée.

### Mesurer un blocage

```ts
import { monitorEventLoopDelay } from 'node:perf_hooks';
const h = monitorEventLoopDelay();
h.enable();
setInterval(() => console.log('p99 lag (ms)', h.percentile(99) / 1e6), 5000);
```

Un lag de plusieurs dizaines de ms = du code synchrone trop long (JSON énorme, regex catastrophique, boucle sur 1 M d'éléments).

## Modules : CommonJS et ESM

| | CommonJS | ESM |
| --- | --- | --- |
| Syntaxe | `require` / `module.exports` | `import` / `export` |
| Activation | défaut, `.cjs` | `"type": "module"`, `.mjs` |
| Chargement | synchrone | asynchrone, graphe statique |
| Chemins | `__dirname`, `__filename` | `import.meta.dirname`, `import.meta.filename` |
| `await` top-level | ❌ | ✅ |

Depuis Node 22.12 / 20.19, **`require()` peut charger un module ESM** synchrone (sans `await` top-level). Cela a mis fin à la plupart des problèmes de « dual package ».

Le champ `exports` de `package.json` définit l'API publique d'un paquet et les conditions :

```json
{
  "name": "@acme/sdk",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./errors": "./dist/errors.js"
  },
  "imports": { "#db/*": "./src/db/*.js" }
}
```

`imports` (*subpath imports*, préfixe `#`) fournit des **alias internes** compris nativement par Node, TS et les bundlers — l'alternative standard à `paths`.

## Buffers et streams

`Buffer` = séquence d'octets (sous-classe de `Uint8Array`). Les **streams** traitent les données **par morceaux** au lieu de tout charger en mémoire.

| Type | Exemple |
| --- | --- |
| Readable | `fs.createReadStream`, `req` HTTP entrant |
| Writable | `fs.createWriteStream`, `res` HTTP |
| Duplex | socket TCP |
| Transform | `zlib.createGzip()`, chiffrement |

```ts
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

await pipeline(createReadStream('logs.txt'), createGzip(), createWriteStream('logs.txt.gz'));
```

- **Backpressure** : si le consommateur est plus lent, `write()` renvoie `false` et le producteur doit attendre `'drain'`. `pipeline` gère cela **et** propage les erreurs en détruisant tous les streams — contrairement à `.pipe()`.
- Les Readable sont des **itérables asynchrones** : `for await (const chunk of stream) {}`.
- Node expose aussi les **Web Streams** (`ReadableStream`, utilisés par `fetch`) ; `Readable.fromWeb` / `Readable.toWeb` font le pont.

## `process`, signaux et arrêt propre

```ts
process.env.DATABASE_URL;   // toujours string | undefined
process.argv;               // [node, script, ...args]
process.exitCode = 1;       // préférer à process.exit() : laisse les I/O en cours se terminer

process.on('SIGTERM', async () => {   // envoyé par Docker / Kubernetes avant de tuer le conteneur
  server.close();                       // n'accepte plus de connexions
  await db.end();
  process.exit(0);
});
```

## Erreurs

- Une exception non attrapée ou une **promesse rejetée sans handler** (`unhandledRejection`, mode `throw` par défaut depuis Node 15) **arrête le processus**.
- `process.on('uncaughtException')` sert à **logger puis quitter**, pas à continuer : l'état de l'application est inconnu.
- On laisse le gestionnaire de processus (Docker, Kubernetes, systemd) redémarrer.
- Les callbacks historiques suivent la convention *error-first* `(err, result) => {}` ; `util.promisify` ou les modules `node:fs/promises`, `node:timers/promises` fournissent des versions à base de promesses.

## Utiliser plusieurs cœurs

| Outil | Usage |
| --- | --- |
| `worker_threads` | calcul CPU lourd dans le **même processus** (mémoire partageable via `SharedArrayBuffer`) |
| `child_process` | lancer un autre programme (`spawn`, `execFile`) |
| `cluster` | plusieurs processus Node qui partagent un port |
| En production | plutôt **N conteneurs / pods** derrière un load balancer |

```ts
import { Worker } from 'node:worker_threads';
const worker = new Worker(new URL('./resize.js', import.meta.url), { workerData: { path } });
worker.on('message', (result) => console.log(result));
```

## Contexte asynchrone : `AsyncLocalStorage`

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage<{ requestId: string }>();

app.use((req, res, next) => als.run({ requestId: crypto.randomUUID() }, next));
// n'importe où plus loin, même après des await :
logger.info({ requestId: als.getStore()?.requestId }, 'requête traitée');
```

C'est la base du *request context* (logs corrélés, tracing OpenTelemetry, transaction courante) sans passer l'objet partout.

## Pour aller plus loin

- [Node.js — The Event Loop (EN)](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js — Don't Block the Event Loop (EN)](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
- [Node.js — Backpressuring in Streams (EN)](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
- [Node.js Best Practices — Gestion des erreurs (FR)](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md#2-gestion-des-erreurs)

<!-- QUIZ -->

### Dans quel ordre s'affichent les messages ?
```ts
setTimeout(() => console.log('A'), 0);
Promise.resolve().then(() => console.log('B'));
process.nextTick(() => console.log('C'));
console.log('D');
```
- [ ] A, B, C, D
- [ ] D, A, B, C
- [x] D, C, B, A
- [ ] D, B, C, A
> Le code synchrone d'abord (`D`). Puis, avant de passer à une phase de l'event loop, Node vide la file `nextTick` (`C`), puis les microtâches de promesses (`B`). Le timer (`A`) n'est traité qu'à la phase *timers*.
[doc]: Node.js — process.nextTick() vs setImmediate() (EN) | https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick#processnexttick

### Que se passe-t-il quand une route Express exécute `crypto.pbkdf2Sync` avec un million d'itérations ?
- [ ] Rien de particulier, Node est multi-thread
- [x] Toutes les autres requêtes sont bloquées pendant le calcul, car le JavaScript s'exécute sur un seul thread
- [ ] Node lance automatiquement un worker
- [ ] La requête est annulée après 100 ms
> Une API `*Sync` monopolise le thread principal : l'event loop ne traite plus aucune I/O. La version asynchrone `crypto.pbkdf2` s'exécute dans le thread pool de libuv et libère le thread principal.
[doc]: Node.js — Don't Block the Event Loop (EN) | https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop

### Quelles opérations utilisent le thread pool de libuv ? (plusieurs réponses)
- [x] `fs.readFile`
- [x] `crypto.pbkdf2` (version asynchrone)
- [x] `dns.lookup`
- [ ] Une requête HTTP sortante via un socket TCP
> Le réseau utilise les mécanismes asynchrones du système (epoll, kqueue, IOCP) sans thread dédié. Le système de fichiers, `dns.lookup`, une partie de `crypto` et `zlib` passent par le thread pool (4 threads par défaut, réglable via `UV_THREADPOOL_SIZE`).
[doc]: Node.js — Don't Block the Event Loop, libuv thread pool (EN) | https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop#what-code-runs-on-the-worker-pool

### Dans un callback de `fs.readFile`, qui s'exécute en premier ?
```ts
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
```
- [ ] `timeout`, toujours
- [x] `immediate`, toujours
- [ ] L'ordre n'est pas déterministe
- [ ] Aucun des deux ne s'exécute
> Le callback tourne dans la phase *poll* ; la phase suivante est *check* (`setImmediate`), avant de revenir aux *timers* au tour suivant. Depuis le module principal, en revanche, l'ordre dépend des performances du processus.
[doc]: Node.js — setImmediate() vs setTimeout() (EN) | https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick#setimmediate-vs-settimeout

### Pourquoi préférer `pipeline()` à `.pipe()` pour enchaîner des streams ?
- [ ] `pipeline` est plus rapide
- [x] `pipeline` propage les erreurs de n'importe quel stream et détruit proprement toute la chaîne ; `.pipe()` ne le fait pas
- [ ] `.pipe()` ne gère pas la backpressure
- [ ] `.pipe()` est déprécié
> Avec `.pipe()`, une erreur dans un stream intermédiaire laisse les autres ouverts (fuite de descripteurs) et doit être écoutée sur chaque stream. `stream/promises.pipeline` retourne une promesse rejetée et nettoie tout.
[doc]: Node.js — stream.pipeline (EN) | https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options

### Que signifie `writable.write(chunk)` qui renvoie `false` ?
- [ ] L'écriture a échoué
- [x] Le buffer interne est plein : il faut attendre l'événement `'drain'` avant de continuer à écrire
- [ ] Le stream est fermé
- [ ] Le chunk a été ignoré
> C'est le mécanisme de **backpressure**. Ignorer ce signal fait grossir la mémoire sans limite quand le producteur est plus rapide que le consommateur (disque lent, client réseau lent).
[doc]: Node.js — Backpressuring in Streams (EN) | https://nodejs.org/en/learn/modules/backpressuring-in-streams

### Comment obtenir le dossier du fichier courant dans un module ESM (Node 20.11+) ?
- [ ] `__dirname`
- [x] `import.meta.dirname`
- [ ] `process.cwd()`
- [ ] `require.main.path`
> `__dirname` et `__filename` n'existent qu'en CommonJS. `import.meta.dirname` et `import.meta.filename` les remplacent en ESM. `process.cwd()` est le dossier depuis lequel le processus a été lancé, pas celui du fichier.
[doc]: Node.js — import.meta.dirname (EN) | https://nodejs.org/api/esm.html#importmetadirname

### Que permet `require()` d'un module ESM dans Node 22.12+ et 20.19+ ?
- [ ] Rien, c'est toujours interdit
- [x] Charger un module ESM depuis du CommonJS, à condition qu'il n'utilise pas d'`await` top-level
- [ ] Charger un module ESM de manière asynchrone
- [ ] Convertir un module ESM en CommonJS sur disque
> `require(esm)` charge le graphe de façon synchrone. Si un module du graphe contient un `await` top-level, Node lève `ERR_REQUIRE_ASYNC_MODULE` et il faut passer par `import()`. La fonctionnalité n'est plus expérimentale depuis Node 25.4.
[doc]: Node.js — Loading ECMAScript modules using require() (EN) | https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require

### À quoi sert le champ `imports` de `package.json` ?
```json
{ "imports": { "#db/*": "./src/db/*.js" } }
```
- [ ] À lister les dépendances à installer
- [x] À définir des alias d'import internes au paquet (`import x from '#db/pool.js'`), compris nativement par Node
- [ ] À exposer des modules aux autres paquets
- [ ] À précharger des modules au démarrage
> Les *subpath imports* commencent par `#` et ne sont visibles que dans le paquet. Contrairement à `paths` de tsconfig, ils fonctionnent à l'exécution sans outil supplémentaire, et TypeScript les comprend avec `nodenext` ou `bundler`.
[doc]: Node.js — Subpath imports (EN) | https://nodejs.org/api/packages.html#subpath-imports

### Que fait Node par défaut quand une promesse est rejetée sans aucun handler ?
- [ ] Il affiche un avertissement et continue
- [x] Il lève l'erreur comme une exception non attrapée et arrête le processus
- [ ] Il ignore silencieusement le rejet
- [ ] Il relance la promesse
> Depuis Node 15, `--unhandled-rejections=throw` est le défaut. C'est voulu : une promesse rejetée oubliée cache un bug. La règle `@typescript-eslint/no-floating-promises` aide à les détecter avant l'exécution.
[doc]: Node.js — Event 'unhandledRejection' (EN) | https://nodejs.org/api/process.html#event-unhandledrejection

### Que doit faire un handler `process.on('uncaughtException')` ?
- [ ] Ignorer l'erreur et continuer à servir les requêtes
- [x] Logger l'erreur, libérer ce qui peut l'être, puis quitter : un orchestrateur relancera le processus
- [ ] Redémarrer le serveur HTTP dans le même processus
- [ ] Rien, ce handler est interdit
> Après une exception non attrapée, l'état de l'application est indéfini (transactions à moitié faites, ressources non libérées). Continuer expose à des bugs bien pires. On laisse Docker, Kubernetes ou systemd redémarrer.
[doc]: Node.js — Warning: using 'uncaughtException' correctly (EN) | https://nodejs.org/api/process.html#warning-using-uncaughtexception-correctly

### Kubernetes envoie `SIGTERM` à un pod Node. Que doit faire l'application ?
- [ ] Quitter immédiatement avec `process.exit(1)`
- [x] Arrêter d'accepter de nouvelles connexions, terminer les requêtes en cours, fermer les connexions (BDD, files), puis quitter
- [ ] Ignorer le signal
- [ ] Redémarrer
> C'est le *graceful shutdown*. Sans lui, les requêtes en vol sont coupées net à chaque déploiement. Kubernetes envoie `SIGKILL` après le délai `terminationGracePeriodSeconds` (30 s par défaut).
[doc]: Node.js — Signal events (EN) | https://nodejs.org/api/process.html#signal-events

### Pourquoi préférer `process.exitCode = 1` à `process.exit(1)` ?
- [ ] `process.exit` est déprécié
- [x] `process.exit` termine immédiatement, même si des écritures asynchrones (logs, stdout) sont en cours ; `exitCode` laisse le processus se terminer naturellement
- [ ] `exitCode` redémarre le processus
- [ ] Il n'y a aucune différence
> `process.exit()` coupe court : un log envoyé juste avant peut être perdu. Fixer `exitCode` et laisser l'event loop se vider garantit que tout est écrit.
[doc]: Node.js — process.exitCode (EN) | https://nodejs.org/api/process.html#processexitcode_1

### Une API doit redimensionner des images (calcul CPU intensif). Quelle solution Node est adaptée ?
- [ ] Rendre la fonction `async`
- [x] Exécuter le calcul dans un `worker_threads` (ou un pool de workers comme Piscina)
- [ ] Utiliser `setImmediate` en boucle
- [ ] Augmenter `UV_THREADPOOL_SIZE`
> `async` ne rend pas un calcul parallèle : il tourne toujours sur le thread principal. Un worker a son propre isolat V8 et sa propre event loop. `UV_THREADPOOL_SIZE` ne concerne que les opérations natives de libuv, pas votre JavaScript.
[doc]: Node.js — Worker threads (EN) | https://nodejs.org/api/worker_threads.html

### À quoi sert `AsyncLocalStorage` ?
- [ ] À stocker des données dans le localStorage du navigateur
- [x] À propager un contexte (ID de requête, utilisateur, transaction) à travers les appels asynchrones sans le passer en paramètre
- [ ] À mettre en cache des réponses HTTP
- [ ] À partager de la mémoire entre workers
> `als.run(store, fn)` rend `store` accessible via `als.getStore()` dans tout le code appelé par `fn`, même après des `await`. C'est ce qu'utilisent les loggers pour corréler les logs et OpenTelemetry pour le tracing. `nestjs-cls` s'appuie dessus.
[doc]: Node.js — AsyncLocalStorage (EN) | https://nodejs.org/api/async_context.html#class-asynclocalstorage

### Quelle est la différence entre `Buffer` et `string` ?
- [ ] Aucune, ce sont deux noms pour le même type
- [x] Un `Buffer` contient des octets bruts ; une `string` contient du texte, et la conversion nécessite un encodage (`utf8`, `base64`…)
- [ ] Un `Buffer` est toujours plus petit
- [ ] Une `string` ne peut pas contenir d'emoji
> `Buffer.from('é').length === 2` (deux octets en UTF-8) alors que `'é'.length === 1`. Découper un buffer UTF-8 au milieu d'un caractère multi-octets corrompt le texte : `StringDecoder` ou `setEncoding('utf8')` sur un stream gèrent ce cas.
[doc]: Node.js — Buffer (EN) | https://nodejs.org/api/buffer.html

### Que révèle un *event loop lag* p99 de 300 ms mesuré avec `monitorEventLoopDelay` ?
- [ ] La base de données est lente
- [x] Du code synchrone monopolise régulièrement le thread principal pendant des centaines de millisecondes
- [ ] Le réseau est saturé
- [ ] Le garbage collector est désactivé
> Une requête BDD lente n'augmente pas le lag : pendant l'attente, l'event loop est libre. Le lag mesure le retard des callbacks à s'exécuter, donc du CPU consommé sur le thread principal (`JSON.parse` géant, tri d'un gros tableau, regex catastrophique). Un profil CPU (`--cpu-prof`) localise le coupable.
[doc]: Node.js — perf_hooks.monitorEventLoopDelay (EN) | https://nodejs.org/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions

### Comment lire un gros fichier ligne par ligne sans le charger entièrement en mémoire ?
- [ ] `fs.readFileSync(path, 'utf8').split('\n')`
- [x] `readline.createInterface({ input: fs.createReadStream(path) })` puis `for await (const ligne of rl)`
- [ ] `JSON.parse(fs.readFileSync(path))`
- [ ] `fs.promises.readFile(path)` puis `split`
> Les deux premières lectures complètes chargent tout le fichier en mémoire : impossible avec plusieurs Go. Le stream lit par morceaux de 64 Kio, et `readline` reconstitue les lignes. L'itération asynchrone respecte la backpressure.
[doc]: Node.js — readline, exemple ligne par ligne (EN) | https://nodejs.org/api/readline.html#example-read-file-stream-line-by-line
