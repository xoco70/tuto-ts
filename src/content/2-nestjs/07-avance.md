---
id: nest-avance
track: nestjs
order: 7
title: NestJS avancé - queues, événements, CQRS, microservices, prod
level: Senior
summary: Configuration, événements, BullMQ, CQRS, microservices et transports, WebSockets, cache, GraphQL, observabilité et mise en production.
---

## Configuration

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validate: (env) => envSchema.parse(env),      // Zod, ou validationSchema Joi
});
const port = this.config.getOrThrow<number>('PORT');
```

Valider l'environnement **au démarrage** : mieux vaut un crash immédiat qu'une erreur en pleine nuit sur une variable manquante.

## Événements internes

```ts
// @nestjs/event-emitter
this.events.emit('order.paid', new OrderPaidEvent(order.id));

@OnEvent('order.paid', { async: true })
async sendInvoice(event: OrderPaidEvent) {}
```

Découple les modules (fin des dépendances circulaires), mais : **en mémoire**, pas de persistance ni de retry. Si le process crashe, l'événement est perdu → pour du critique, une **queue**.

## Queues avec BullMQ

```ts
BullModule.forRoot({ connection: { host: 'redis', port: 6379 } });
BullModule.registerQueue({ name: 'emails' });

await this.emailsQueue.add('welcome', { userId }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  jobId: `welcome:${userId}`,          // déduplication
  removeOnComplete: true,
});

@Processor('emails')
export class EmailsProcessor extends WorkerHost {
  async process(job: Job<{ userId: string }>) { /* ... */ }
}
```

Usages : emails, génération de PDF, webhooks sortants, imports, tout traitement lent ou faillible. Les jobs doivent être **idempotents** (un job peut être rejoué après un crash).

## CQRS

```ts
// @nestjs/cqrs
await this.commandBus.execute(new PlaceOrderCommand(userId, items));

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  async execute(cmd: PlaceOrderCommand) { /* écriture + publication d'événements */ }
}
```

Séparer **commandes** (écriture, règles métier) et **requêtes** (lecture, modèles optimisés). Utile pour des domaines complexes ; *overkill* pour un CRUD.

## Microservices

```ts
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.RMQ,
  options: { urls: ['amqp://rabbit'], queue: 'orders' },
});

@MessagePattern('orders.get')     // requête / réponse
getOrder(@Payload() id: string) {}

@EventPattern('user.created')      // événement, pas de réponse
onUserCreated(@Payload() data: UserCreated) {}
```

Transports : TCP, Redis, NATS, MQTT, RabbitMQ, Kafka, gRPC. Une app **hybride** (`app.connectMicroservice()`) sert HTTP et messages.

## WebSockets

```ts
@WebSocketGateway({ cors: { origin: 'https://app.exemple.fr' } })
export class ChatGateway {
  @WebSocketServer() server!: Server;
  @SubscribeMessage('message')
  handle(@MessageBody() msg: string, @ConnectedSocket() client: Socket) {
    this.server.to('room-1').emit('message', msg);
  }
}
```

Avec plusieurs instances, il faut un **adapter Redis** pour diffuser entre instances.

## Cache

`@nestjs/cache-manager` + `CacheInterceptor` (GET uniquement) ou cache manuel (`cache.get/set`). Penser **invalidation**, TTL et clé incluant l'utilisateur si la réponse est personnalisée.

## GraphQL (code first)

```ts
@Resolver(() => User)
export class UsersResolver {
  @Query(() => User) user(@Args('id') id: string) {}
  @ResolveField(() => [Order]) orders(@Parent() user: User) {}  // → DataLoader contre le N+1
}
```

## Mise en production

- `app.enableShutdownHooks()` : arrêt propre sur `SIGTERM` (finir les requêtes, fermer DB/queues).
- **Health checks** avec `@nestjs/terminus` : `/health/live` (process vivant) et `/health/ready` (DB, Redis joignables).
- **Logs structurés JSON** (`nestjs-pino`), avec un *correlation id* propagé.
- **Observabilité** : OpenTelemetry (traces), métriques Prometheus.
- `FastifyAdapter` pour plus de débit qu'Express.
- Versioning d'API : `app.enableVersioning({ type: VersioningType.URI })` → `/v1/...`.
- Build swc + `node dist/main.js` dans une image Docker multi-stage, utilisateur non-root.

<!-- QUIZ -->

### Quelle est la différence entre `@MessagePattern` et `@EventPattern` ?
- [ ] Aucune
- [x] `@MessagePattern` implémente un échange requête/réponse ; `@EventPattern` traite un événement sans renvoyer de réponse
- [ ] `@EventPattern` est réservé à Kafka
- [ ] `@MessagePattern` est synchrone
> Côté client : `client.send()` (attend une réponse, retourne un Observable) vs `client.emit()` (fire-and-forget). Préférer les événements pour découpler les services.
[doc]: NestJS — Microservices, event-based (EN) | https://docs.nestjs.com/microservices/basics#event-based

### Pourquoi préférer une queue BullMQ à `@nestjs/event-emitter` pour envoyer un email de confirmation de commande ?
- [ ] EventEmitter ne supporte pas l'asynchrone
- [x] BullMQ persiste les jobs dans Redis, gère les retries avec backoff et survit à un crash ; EventEmitter est en mémoire
- [ ] BullMQ est synchrone
- [ ] EventEmitter ne fonctionne pas avec NestJS
> Un événement en mémoire est perdu si le process s'arrête. Pour tout effet qui doit **forcément** se produire, une queue durable (ou le pattern outbox) est nécessaire.
[doc]: NestJS — Queues (EN) | https://docs.nestjs.com/techniques/queues

### Pourquoi un job de queue doit-il être idempotent ?
- [ ] Pour qu'il soit plus rapide
- [x] Parce qu'il peut être exécuté plusieurs fois (retry après erreur, crash du worker après le traitement mais avant l'acquittement)
- [ ] Parce que BullMQ l'impose syntaxiquement
- [ ] Pour pouvoir le supprimer
> Les queues garantissent généralement « au moins une fois » (*at-least-once*). Rendre le job idempotent (vérifier si l'email a déjà été envoyé, clé d'idempotence côté prestataire) évite les doublons.
[doc]: BullMQ — Retrying failing jobs (EN) | https://docs.bullmq.io/guide/retrying-failing-jobs

### Dans quel cas CQRS est-il pertinent ?
- [ ] Pour tout projet NestJS
- [x] Pour un domaine complexe où écriture et lecture ont des besoins différents (règles métier riches, projections de lecture, événements)
- [ ] Pour un simple CRUD
- [ ] Uniquement avec MongoDB
> CQRS ajoute de l'indirection (commandes, handlers, buses). Sur un CRUD, c'est de la complexité sans bénéfice ; sur un domaine riche, il clarifie les cas d'usage et facilite l'*event sourcing*.
[doc]: NestJS — CQRS (EN) | https://docs.nestjs.com/recipes/cqrs

### Une app WebSocket Socket.IO tourne sur 3 instances derrière un load balancer. Un `server.emit` n'atteint qu'une partie des clients. Pourquoi ?
- [ ] Socket.IO ne supporte pas `emit`
- [x] Chaque instance ne connaît que ses propres connexions : il faut un adapter (Redis) pour diffuser entre instances
- [ ] Le load balancer bloque les WebSockets
- [ ] Il faut utiliser `broadcast` au lieu d'`emit`
> L'adapter Redis (pub/sub) relaie les émissions à toutes les instances. Il faut aussi des *sticky sessions* si le polling HTTP de Socket.IO est utilisé.
[doc]: NestJS — WebSockets adapters, Redis (EN) | https://docs.nestjs.com/websockets/adapter#extend-socketio

### À quoi servent les endpoints `/health/live` et `/health/ready` ?
- [ ] À afficher la documentation
- [x] Liveness : le process répond (sinon on le redémarre) ; readiness : il peut recevoir du trafic (DB, Redis joignables), sinon on le retire du load balancer
- [ ] À mesurer le temps de réponse moyen
- [ ] À vérifier la version de Node
> Ne pas mettre de dépendances externes dans la liveness : une panne de base ferait redémarrer en boucle tous les pods. `@nestjs/terminus` fournit les indicateurs (TypeORM, Prisma, HTTP, mémoire, disque).
[doc]: NestJS — Health checks (Terminus) (EN) | https://docs.nestjs.com/recipes/terminus

### Pourquoi valider les variables d'environnement au démarrage ?
- [ ] Pour accélérer le démarrage
- [x] Pour échouer immédiatement et clairement (fail fast) plutôt qu'au premier usage d'une variable manquante ou mal formée, en production
- [ ] Parce que `process.env` est vide sinon
- [ ] Pour chiffrer les secrets
> `ConfigModule.forRoot({ validate })` ou `validationSchema` vérifient types et présence. Un déploiement mal configuré ne passe alors même pas la readiness.
[doc]: NestJS — Configuration, schema validation (EN) | https://docs.nestjs.com/techniques/configuration#schema-validation

### Pourquoi utiliser des logs structurés (JSON) en production ?
- [ ] Ils sont plus lisibles dans un terminal
- [x] Ils sont indexables et requêtables (par `requestId`, `userId`, niveau…) dans un outil d'agrégation (Datadog, Loki, ELK)
- [ ] Ils prennent moins de place
- [ ] Node l'impose
> Avec un *correlation id* propagé (header `x-request-id`, AsyncLocalStorage), on suit une requête à travers tous les services. `nestjs-pino` est très performant.
[doc]: NestJS — Logger (EN) | https://docs.nestjs.com/techniques/logger

### Comment éviter le N+1 dans un resolver GraphQL `@ResolveField() orders(@Parent() user)` appelé pour 50 utilisateurs ?
- [ ] Mettre le resolver en cache global
- [x] Utiliser un DataLoader request-scoped qui regroupe les 50 `userId` en une seule requête
- [ ] Charger toutes les commandes de la base au démarrage
- [ ] GraphQL résout le problème automatiquement
> Le DataLoader collecte les clés demandées pendant un tick puis appelle une fonction de batch unique. Il doit être créé **par requête** pour ne pas partager le cache entre utilisateurs.
[doc]: NestJS — GraphQL resolvers (EN) | https://docs.nestjs.com/graphql/resolvers

### Quel est l'intérêt de `FastifyAdapter` ?
- [ ] Il ajoute GraphQL
- [x] Il remplace Express par Fastify, plus performant (débit, sérialisation), avec quelques différences d'écosystème (middlewares Express non compatibles)
- [ ] Il compile l'application en Rust
- [ ] Il est obligatoire en production
> `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`. Le code Nest reste le même tant qu'on n'utilise pas directement les objets `req`/`res` d'Express.
[doc]: NestJS — Performance (Fastify) (EN) | https://docs.nestjs.com/techniques/performance

### Comment versionner une API REST NestJS par l'URL (`/v1/users`, `/v2/users`) ?
- [ ] Créer deux applications Nest
- [x] `app.enableVersioning({ type: VersioningType.URI })` puis `@Version('2')` ou `@Controller({ version: '1' })`
- [ ] Préfixer manuellement chaque route
- [ ] Ce n'est pas supporté
> Nest supporte le versioning par URI, header, media type ou une fonction personnalisée. Une version par défaut évite de casser les clients existants.
[doc]: NestJS — Versioning (EN) | https://docs.nestjs.com/techniques/versioning

### Que doit faire une application lors d'un `SIGTERM` envoyé pendant un déploiement ?
- [ ] S'arrêter immédiatement
- [x] Arrêter d'accepter de nouvelles requêtes, terminer celles en cours, fermer proprement les connexions (DB, queues), puis quitter
- [ ] Ignorer le signal
- [ ] Redémarrer
> C'est le *graceful shutdown*. Sans lui : requêtes coupées, jobs interrompus, transactions abandonnées. Kubernetes laisse `terminationGracePeriodSeconds` (30 s par défaut) avant le `SIGKILL`.
[doc]: NestJS — Lifecycle events, application shutdown (EN) | https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown

### Comment planifier une tâche quotidienne à 3 h du matin dans NestJS ?
- [ ] `setInterval` dans le constructeur d'un service
- [x] `@Cron('0 3 * * *')` avec `@nestjs/schedule` (ou un job répétable BullMQ si plusieurs instances)
- [ ] Une boucle `while (true)`
- [ ] Ce n'est pas possible
> Attention : avec N instances, un `@Cron` s'exécute N fois. Pour une exécution unique, utiliser un verrou distribué ou un job répétable BullMQ (dédupliqué par Redis).
[doc]: NestJS — Task scheduling (EN) | https://docs.nestjs.com/techniques/task-scheduling

### Quels traitements devraient être déportés dans une queue plutôt qu'exécutés pendant la requête HTTP ? (plusieurs réponses)
- [x] La génération d'un PDF de 200 pages
- [x] L'envoi de webhooks à des systèmes tiers
- [x] L'import d'un fichier CSV de 100 000 lignes
- [ ] La lecture d'un utilisateur par son id
> Tout ce qui est lent, faillible ou dépendant d'un tiers gagne à être asynchrone : la requête renvoie vite (202 Accepted + id de job) et le traitement bénéficie de retries.
[doc]: NestJS — Queues (EN) | https://docs.nestjs.com/techniques/queues

### `configService.get<number>('PORT')` renvoie-t-il un nombre ?
- [ ] Oui, le générique convertit la valeur
- [x] Non : les variables d'environnement sont des chaînes, le générique ne fait qu'annoncer un type
- [ ] Oui, si `PORT` contient uniquement des chiffres
- [ ] Non, il renvoie toujours `undefined`
> Le paramètre de type est une simple **assertion**. Pour obtenir un vrai nombre, il faut transformer à la validation (Joi `Joi.number()`, Zod `z.coerce.number()`) ou dans une fonction `registerAs`.
[doc]: NestJS — Configuration (EN) | https://docs.nestjs.com/techniques/configuration#using-the-configservice

### Comment propager un identifiant de corrélation dans tous les logs d'une requête sans passer en scope `REQUEST` ?
- [ ] Une variable globale
- [x] `AsyncLocalStorage` (par exemple via `nestjs-cls`)
- [ ] Un singleton qui stocke la dernière requête
- [ ] Un cookie
> `AsyncLocalStorage` conserve un contexte à travers les `await` d'une même requête, sans recréer les providers à chaque requête (ce que fait le scope `REQUEST`). Les loggers comme pino peuvent ensuite l'ajouter à chaque ligne.
[doc]: NestJS — Async Local Storage (EN) | https://docs.nestjs.com/recipes/async-local-storage

### Comment pousser des notifications du serveur vers le navigateur sans WebSocket, sur une connexion HTTP simple ?
- [ ] Avec du long polling uniquement
- [x] Avec les Server-Sent Events : `@Sse('notifications')` retourne un `Observable`
- [ ] Avec `@MessagePattern`
- [ ] C'est impossible en HTTP
> Les SSE sont unidirectionnels (serveur → client), passent par HTTP standard, et le navigateur se reconnecte automatiquement (`EventSource`). Suffisant pour des notifications ou une progression ; WebSocket reste utile pour des échanges bidirectionnels.
[doc]: NestJS — Server-Sent Events (EN) | https://docs.nestjs.com/techniques/server-sent-events

### Quelles réponses le `CacheInterceptor` de Nest met-il en cache par défaut ?
- [ ] Toutes les requêtes
- [x] Uniquement les requêtes `GET`
- [ ] Uniquement les `POST`
- [ ] Aucune, il faut configurer chaque route
> Mettre en cache une mutation n'aurait pas de sens. La clé par défaut est l'URL : attention aux réponses personnalisées par utilisateur, qu'il faut exclure ou dont il faut adapter la clé (`trackBy`).
[doc]: NestJS — Caching (EN) | https://docs.nestjs.com/techniques/caching

### L'API tourne sur 4 instances avec `@nestjs/throttler` à 10 requêtes/minute. Un client peut-il faire 40 requêtes par minute ?
- [ ] Non, la limite est partagée automatiquement
- [x] Oui, si le stockage est en mémoire : chaque instance compte de son côté. Il faut un stockage partagé (Redis)
- [ ] Non, le load balancer applique la limite
- [ ] Oui, mais seulement en HTTP/2
> Tout état en mémoire est local à une instance. Pour un rate limiting cohérent, le throttler doit utiliser un stockage commun — ou la limite est appliquée en amont (API gateway, reverse proxy).
[doc]: NestJS — Rate limiting, storages (EN) | https://docs.nestjs.com/security/rate-limiting#storages

### Pourquoi le SDK OpenTelemetry doit-il être initialisé avant d'importer le reste de l'application ?
- [ ] Pour lire les variables d'environnement
- [x] L'auto-instrumentation modifie les modules (`http`, `pg`, `express`…) au chargement : chargés avant, ils ne seraient pas tracés
- [ ] Pour éviter les dépendances circulaires
- [ ] Ce n'est pas nécessaire
> On place l'initialisation dans un fichier chargé en premier (`node --import ./tracing.js dist/main.js`, ou première ligne de `main.ts`). Sinon les traces n'apparaissent pas, sans aucune erreur.
[doc]: OpenTelemetry — Node.js getting started (EN) | https://opentelemetry.io/docs/languages/js/getting-started/nodejs/

### Que devient un job BullMQ qui a échoué à toutes ses tentatives (`attempts: 5`) ?
- [ ] Il est supprimé
- [x] Il passe dans l'ensemble des jobs `failed`, où il peut être inspecté et relancé
- [ ] Il est réessayé indéfiniment
- [ ] Il fait planter le worker
> Les jobs en échec définitif jouent le rôle d'une *dead letter queue* : il faut les surveiller (alerte, tableau de bord type Bull Board) et prévoir une procédure de reprise. `removeOnFail` permet d'en limiter le nombre conservé.
[doc]: BullMQ — Retrying failing jobs (EN) | https://docs.bullmq.io/guide/retrying-failing-jobs

### Quelle est la différence entre les approches « code first » et « schema first » de `@nestjs/graphql` ?
- [ ] Code first ne supporte pas les mutations
- [x] Code first génère le schéma SDL à partir de classes décorées ; schema first génère les types TypeScript à partir du SDL
- [ ] Schema first est réservé aux microservices
- [ ] Il n'y a aucune différence
> Code first garde une seule source de vérité dans le code TypeScript (proche des DTO). Schema first convient quand le schéma GraphQL est le contrat partagé avec d'autres équipes.
[doc]: NestJS — GraphQL quick start (EN) | https://docs.nestjs.com/graphql/quick-start
