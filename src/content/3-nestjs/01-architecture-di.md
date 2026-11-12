---
id: nest-architecture
track: nestjs
order: 1
title: Architecture, modules et injection de dépendances
level: Intermédiaire
summary: Modules et encapsulation, providers custom (useClass/useValue/useFactory/useExisting), scopes, modules dynamiques, dépendances circulaires, hooks de cycle de vie.
---

## Les briques

- **Module** (`@Module`) : unité d'organisation, frontière d'encapsulation.
- **Controller** (`@Controller`) : reçoit les requêtes, délègue, ne contient pas de logique métier.
- **Provider** (`@Injectable`) : tout ce qui peut être injecté (services, repositories, factories, helpers…).

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],        // rendu disponible aux modules qui importent UsersModule
})
export class UsersModule {}
```

### Encapsulation

Un provider est **privé** à son module. Pour l'utiliser ailleurs : l'**exporter** depuis son module **et** importer ce module dans le consommateur. Erreur classique : `Nest can't resolve dependencies of the X (?). Please make sure that the argument Y at index [0] is available in the Z context.`

`@Global()` rend les exports d'un module disponibles partout sans import — à réserver aux briques transverses (config, logger, base de données).

## L'injecteur

Nest construit un **conteneur IoC** au démarrage : il lit les métadonnées des constructeurs (`design:paramtypes`), résout le graphe de dépendances et instancie chaque provider (par défaut **une seule fois** : singleton).

### Providers custom

```ts
providers: [
  UsersService,                                         // raccourci de { provide: UsersService, useClass: UsersService }
  { provide: PaymentGateway, useClass: process.env.NODE_ENV === 'test' ? FakeGateway : StripeGateway },
  { provide: 'APP_NAME', useValue: 'vinyaqui' },
  {
    provide: 'REDIS',
    useFactory: async (config: ConfigService) => createClient({ url: config.get('REDIS_URL') }).connect(),
    inject: [ConfigService],
  },
  { provide: 'AliasedLogger', useExisting: LoggerService },   // alias vers la même instance
]
```

```ts
export const NOTIFIER = Symbol('NOTIFIER');
constructor(@Inject(NOTIFIER) private readonly notifier: Notifier) {}
```

Un token peut être une classe, une chaîne ou un `Symbol` (préférable : pas de collision). Une **interface** ne peut pas être un token.

`useFactory` peut être `async` : Nest attend la promesse avant de démarrer (connexions, chargement de secrets).

## Scopes

| Scope | Instance | Usage |
| --- | --- | --- |
| `DEFAULT` | une seule pour toute l'app (singleton) | 99 % des cas |
| `REQUEST` | une par requête entrante | multi-tenant, contexte utilisateur |
| `TRANSIENT` | une par consommateur | logger contextualisé |

Le scope `REQUEST` **remonte la chaîne** : tout provider (et controller) qui en dépend devient lui aussi request-scoped → coût de performance. Alternatives : passer le contexte en paramètre, `AsyncLocalStorage` (ex. `nestjs-cls`), ou les *durable providers*.

## Modules dynamiques

```ts
@Module({})
export class MailModule {
  static forRoot(options: MailOptions): DynamicModule {
    return {
      module: MailModule,
      global: true,
      providers: [{ provide: MAIL_OPTIONS, useValue: options }, MailService],
      exports: [MailService],
    };
  }
}
```

Convention : `forRoot` (config une fois, souvent globale), `forFeature` (par module consommateur), variante `forRootAsync` (`useFactory` + `inject` + `imports`). `ConfigurableModuleBuilder` génère ce boilerplate.

## Dépendances circulaires

```ts
@Module({ imports: [forwardRef(() => OrdersModule)] })
export class UsersModule {}

constructor(@Inject(forwardRef(() => OrdersService)) private orders: OrdersService) {}
```

`forwardRef` est un pansement. Une circularité signale souvent un mauvais découpage : extraire la logique commune dans un troisième module, ou découpler via des **événements**.

## Hooks de cycle de vie

Ordre au démarrage : `onModuleInit` → `onApplicationBootstrap`.
À l'arrêt : `onModuleDestroy` → `beforeApplicationShutdown` → `onApplicationShutdown`.

Les hooks d'arrêt ne réagissent aux signaux (`SIGTERM` envoyé par Kubernetes/Docker) que si on appelle `app.enableShutdownHooks()` dans `main.ts`.

## ModuleRef

```ts
constructor(private moduleRef: ModuleRef) {}
const strategy = this.moduleRef.get(StripeStrategy, { strict: false });
const scoped = await this.moduleRef.resolve(RequestScopedService);  // pour REQUEST/TRANSIENT
```

Utile pour le *strategy pattern* dynamique ; à éviter comme *service locator* généralisé.

<!-- QUIZ -->

### `OrdersModule` injecte `UsersService` et Nest lève « can't resolve dependencies ». `UsersService` est déclaré dans `UsersModule.providers`. Que manque-t-il le plus probablement ?
- [ ] `@Global()` sur `OrdersModule`
- [x] Exporter `UsersService` depuis `UsersModule` et importer `UsersModule` dans `OrdersModule`
- [ ] Ajouter `UsersService` dans `OrdersModule.controllers`
- [ ] Ajouter `@Inject()` devant le paramètre
> Les providers sont encapsulés dans leur module. Il faut les deux : `exports` côté fournisseur, `imports` côté consommateur. Ré-déclarer `UsersService` dans `OrdersModule.providers` « marcherait » mais créerait une **seconde instance** — bug subtil.
[doc]: NestJS — Modules, shared modules (EN) | https://docs.nestjs.com/modules#shared-modules
[doc]: NestJS — Modules, shared modules (FR) | https://docs.nest-js.fr/modules

### Quel est le scope par défaut d'un provider NestJS ?
- [ ] Une instance par requête
- [x] Singleton : une instance partagée par toute l'application
- [ ] Une instance par module importateur
- [ ] Une instance par injection
> Le scope `DEFAULT` est singleton. Conséquence : ne jamais stocker d'état lié à une requête (utilisateur courant…) dans une propriété d'un service singleton — il serait partagé entre requêtes concurrentes.
[doc]: NestJS — Injection scopes (EN) | https://docs.nestjs.com/fundamentals/injection-scopes
[doc]: NestJS — Injection scopes (FR) | https://docs.nest-js.fr/fundamentals/injection-scopes

### Un service singleton injecte un provider `Scope.REQUEST`. Que se passe-t-il ?
- [ ] Erreur au démarrage
- [ ] Le provider request-scoped devient singleton
- [x] Le service devient lui aussi request-scoped, ainsi que ses consommateurs (le scope remonte la chaîne)
- [ ] Le provider est injecté à `undefined`
> Le scope REQUEST **contamine** toute la chaîne d'injection jusqu'au controller : Nest doit tout ré-instancier à chaque requête, avec un coût mesurable. Pour un simple contexte (tenant, user, correlation id), `AsyncLocalStorage` / `nestjs-cls` est souvent préférable.
[doc]: NestJS — Scope hierarchy (EN) | https://docs.nestjs.com/fundamentals/injection-scopes#scope-hierarchy
[doc]: NestJS — Scope hierarchy (FR) | https://docs.nest-js.fr/fundamentals/injection-scopes

### Quel provider permet de créer un client Redis asynchrone à partir de la configuration ?
- [ ] `{ provide: 'REDIS', useValue: createClient() }`
- [x] `{ provide: 'REDIS', useFactory: async (c: ConfigService) => createClient({ url: c.get('REDIS_URL') }).connect(), inject: [ConfigService] }`
- [ ] `{ provide: 'REDIS', useClass: RedisClient }`
- [ ] `{ provide: 'REDIS', useExisting: ConfigService }`
> `useFactory` reçoit les dépendances listées dans `inject` (dans le même ordre) et peut retourner une Promise : Nest attend sa résolution avant de démarrer l'application.
[doc]: NestJS — Factory providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers#factory-providers-usefactory
[doc]: NestJS — Factory providers (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Que fait `{ provide: 'AliasedLogger', useExisting: LoggerService }` ?
- [ ] Il crée une nouvelle instance de `LoggerService`
- [x] Il crée un alias : le token `'AliasedLogger'` résout la **même instance** que `LoggerService`
- [ ] Il remplace `LoggerService` partout
- [ ] Il vérifie que `LoggerService` existe déjà
> `useExisting` sert à exposer un provider sous plusieurs tokens (ex. une classe concrète aussi accessible via un token d'interface) sans dupliquer l'instance.
[doc]: NestJS — Alias providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers#alias-providers-useexisting
[doc]: NestJS — Alias providers (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Pourquoi préférer un `Symbol` plutôt qu'une chaîne comme token d'injection ?
- [ ] Les chaînes ne sont pas acceptées par Nest
- [x] Un `Symbol` est unique : pas de collision accidentelle entre deux modules qui utiliseraient la même chaîne
- [ ] Les Symbols sont plus rapides à résoudre
- [ ] Les Symbols permettent l'injection d'interfaces sans `@Inject`
> Deux librairies utilisant le token `'CONFIG'` entreraient en conflit. Un `Symbol('CONFIG')` exporté depuis un fichier de constantes évite cela. `@Inject(TOKEN)` reste nécessaire.
[doc]: NestJS — Non-class-based provider tokens (EN) | https://docs.nestjs.com/fundamentals/custom-providers#non-class-based-provider-tokens
[doc]: NestJS — Non-class-based provider tokens (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Quelle est la convention pour un module dynamique configuré une fois pour toute l'application ?
- [ ] `forFeature()`
- [x] `forRoot()` (et `forRootAsync()` quand la config dépend d'autres providers)
- [ ] `register()` uniquement
- [ ] `useModule()`
> `forRoot` configure une fois (connexion, client…), `forFeature` enregistre des éléments propres à un module consommateur (entités, queues). `register` est utilisé pour une config différente à chaque import.
[doc]: NestJS — Dynamic modules, community guidelines (EN) | https://docs.nestjs.com/fundamentals/dynamic-modules#community-guidelines
[doc]: NestJS — Dynamic modules, community guidelines (FR) | https://docs.nest-js.fr/fundamentals/dynamic-modules

### Comment résoudre une dépendance circulaire entre `UsersService` et `OrdersService` ?
- [ ] C'est impossible en NestJS
- [x] `forwardRef(() => ...)` dans les `imports` des modules et dans `@Inject()` des constructeurs — ou mieux, revoir le découpage
- [ ] Déclarer les deux services `@Global()`
- [ ] Passer les deux en `Scope.TRANSIENT`
> `forwardRef` retarde la résolution de la référence. Mais une circularité est un **signal d'architecture** : extraire la logique partagée dans un troisième service, ou découpler par événements (`EventEmitter2`, CQRS).
[doc]: NestJS — Circular dependency (EN) | https://docs.nestjs.com/fundamentals/circular-dependency
[doc]: NestJS — Circular dependency (FR) | https://docs.nest-js.fr/fundamentals/circular-dependency

### Pourquoi les hooks `onModuleDestroy` / `onApplicationShutdown` ne s'exécutent-ils pas quand Kubernetes envoie `SIGTERM` ?
- [ ] Kubernetes envoie `SIGKILL`
- [x] Il faut appeler `app.enableShutdownHooks()` dans `main.ts` pour que Nest écoute les signaux système
- [ ] Ces hooks ne fonctionnent qu'en développement
- [ ] Il faut les déclarer `async`
> Par défaut Nest n'écoute pas les signaux (cela consomme des listeners). Sans `enableShutdownHooks()`, les connexions DB et les jobs en cours ne sont pas fermés proprement lors d'un déploiement : c'est le *graceful shutdown*.
[doc]: NestJS — Application shutdown (EN) | https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown
[doc]: NestJS — Application shutdown (FR) | https://docs.nest-js.fr/fundamentals/lifecycle-events

### Dans quel ordre sont appelés ces hooks au démarrage ?
- [ ] `onApplicationBootstrap` puis `onModuleInit`
- [x] `onModuleInit` puis `onApplicationBootstrap`
- [ ] Ils sont appelés en parallèle
- [ ] Uniquement `onModuleInit`
> `onModuleInit` est appelé quand les dépendances du module sont résolues ; `onApplicationBootstrap` quand **tous** les modules sont initialisés, juste avant d'écouter les connexions.
[doc]: NestJS — Lifecycle events (EN) | https://docs.nestjs.com/fundamentals/lifecycle-events
[doc]: NestJS — Lifecycle events (FR) | https://docs.nest-js.fr/fundamentals/lifecycle-events

### Quel risque y a-t-il à stocker `this.currentUser = req.user` dans un service par défaut ?
- [ ] Aucun
- [x] Le service est singleton : l'utilisateur d'une requête peut être lu par une autre requête concurrente
- [ ] La valeur est perdue à chaque requête
- [ ] Nest interdit les propriétés mutables
> Fuite de données entre utilisateurs : faille de sécurité grave. Le contexte de requête se passe en paramètre, via un provider REQUEST, ou via `AsyncLocalStorage`.
[doc]: NestJS — Injection scopes (EN) | https://docs.nestjs.com/fundamentals/injection-scopes
[doc]: NestJS — Injection scopes (FR) | https://docs.nest-js.fr/fundamentals/injection-scopes

### Que fait `@Global()` sur un module ?
- [ ] Il rend tous ses providers accessibles sans les exporter
- [x] Ses providers **exportés** deviennent injectables partout sans importer le module (il doit être importé une fois, souvent dans `AppModule`)
- [ ] Il transforme ses providers en singletons
- [ ] Il le charge avant tous les autres
> Il faut toujours exporter les providers. `@Global()` évite seulement les imports répétés : à réserver à des briques transverses, sinon on perd la lisibilité des dépendances.
[doc]: NestJS — Global modules (EN) | https://docs.nestjs.com/modules#global-modules
[doc]: NestJS — Global modules (FR) | https://docs.nest-js.fr/modules

### Comment obtenir dynamiquement une instance d'un provider request-scoped depuis `ModuleRef` ?
- [ ] `moduleRef.get(Service)`
- [x] `await moduleRef.resolve(Service)`
- [ ] `moduleRef.create(Service)` uniquement
- [ ] `new Service()`
> `get()` ne fonctionne que pour les providers statiques (singletons). `resolve()` est asynchrone et crée/retourne l'instance d'un sous-arbre REQUEST ou TRANSIENT.
[doc]: NestJS — Module reference (EN) | https://docs.nestjs.com/fundamentals/module-ref
[doc]: NestJS — Module reference (FR) | https://docs.nest-js.fr/fundamentals/module-ref

### Quelles affirmations sur les controllers NestJS sont vraies ? (plusieurs réponses)
- [x] Ils doivent rester fins : la logique métier va dans des providers
- [x] Ils sont déclarés dans le tableau `controllers` d'un module
- [ ] Ils peuvent être exportés et injectés dans d'autres modules
- [ ] Ils sont request-scoped par défaut
> Les controllers ne sont pas des providers : on ne les injecte pas ailleurs. Ils sont singletons par défaut (sauf si une dépendance est request-scoped).
[doc]: NestJS — Controllers (EN) | https://docs.nestjs.com/controllers
[doc]: NestJS — Controllers (FR) | https://docs.nest-js.fr/controllers

### Quel provider est le plus adapté pour injecter un objet de configuration constant ou un faux service dans un test ?
- [ ] `useClass`
- [x] `useValue`
- [ ] `useFactory` sans `inject`
- [ ] `useExisting`
> `{ provide: 'APP_OPTIONS', useValue: { region: 'eu' } }` enregistre une valeur déjà construite. C'est aussi le moyen le plus simple de remplacer un service par un double de test.
[doc]: NestJS — Value providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers#value-providers-usevalue
[doc]: NestJS — Value providers (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Comment injecter un provider enregistré avec un token chaîne ou `Symbol` ?
- [ ] `constructor(private client: 'REDIS_CLIENT')`
- [x] `constructor(@Inject(REDIS_CLIENT) private client: Redis)`
- [ ] `constructor(@Injectable(REDIS_CLIENT) private client: Redis)`
- [ ] Il suffit de typer le paramètre avec `Redis`
> Sans classe comme token, les métadonnées de type ne suffisent pas (et un type comme `Redis` peut être une interface, effacée à la compilation). `@Inject(token)` indique explicitement la clé à résoudre.
[doc]: NestJS — Non-class-based provider tokens (EN) | https://docs.nestjs.com/fundamentals/custom-providers#non-class-based-provider-tokens
[doc]: NestJS — Non-class-based provider tokens (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Que fait `@Optional()` sur un paramètre du constructeur ?
- [ ] Il rend le provider facultatif dans `providers`
- [x] Il injecte `undefined` au lieu de lever une erreur si la dépendance n'est pas résolue
- [ ] Il crée le provider de façon paresseuse
- [ ] Il marque la dépendance comme request-scoped
> Utile pour une dépendance réellement facultative (ex. un objet d'options avec valeurs par défaut). À utiliser avec parcimonie : un oubli d'import dans un module devient alors silencieux.
[doc]: NestJS — Optional providers (EN) | https://docs.nestjs.com/providers#optional-providers
[doc]: NestJS — Optional providers (FR) | https://docs.nest-js.fr/providers

### `UsersService` est déclaré dans le tableau `providers` de `UsersModule` **et** de `OrdersModule`. Que se passe-t-il ?
- [ ] Nest lève une erreur de doublon
- [x] Deux instances distinctes coexistent, chacune avec son propre état
- [ ] Nest réutilise automatiquement la même instance
- [ ] Le second module écrase le premier
> Un singleton l'est **par module qui le déclare**. Redéclarer un service ailleurs crée une seconde instance (et un second cache, une seconde connexion…). La bonne pratique : le déclarer et l'exporter dans un seul module, puis importer ce module.
[doc]: NestJS — Shared modules (EN) | https://docs.nestjs.com/modules#shared-modules
[doc]: NestJS — Shared modules (FR) | https://docs.nest-js.fr/modules

### Que permet le scope `Scope.TRANSIENT` ?
- [ ] Une instance par requête HTTP
- [x] Une nouvelle instance dédiée à chaque consommateur qui l'injecte
- [ ] Une instance unique partagée par toute l'application
- [ ] Une instance détruite après chaque appel de méthode
> Un provider transient n'est pas partagé : chaque classe qui l'injecte reçoit sa propre instance. Cas typique : un logger qui mémorise le contexte (`setContext('OrdersService')`) propre à son consommateur.
[doc]: NestJS — Injection scopes (EN) | https://docs.nestjs.com/fundamentals/injection-scopes
[doc]: NestJS — Injection scopes (FR) | https://docs.nest-js.fr/fundamentals/injection-scopes

### Quelle est la différence entre `TypeOrmModule.forRoot()` et `TypeOrmModule.forFeature([User])` ?
- [ ] `forFeature` crée une seconde connexion à la base
- [x] `forRoot` configure la connexion une fois ; `forFeature` enregistre les repositories des entités dans un module donné
- [ ] `forRoot` est réservé aux tests
- [ ] Il n'y a pas de différence
> Convention des modules dynamiques : `forRoot` (configuration globale, une fois, dans `AppModule`) et `forFeature` (ce dont un module métier a besoin). Les modules de la communauté suivent le même schéma (`BullModule.registerQueue`, `JwtModule.register`…).
[doc]: NestJS — Database / repository pattern (EN) | https://docs.nestjs.com/techniques/database#repository-pattern
[doc]: NestJS — Database / repository pattern (FR) | https://docs.nest-js.fr/techniques/database

### Comment choisir l'implémentation d'un port `MAILER` selon l'environnement ?
- [ ] Avec un `if` dans chaque service qui envoie des emails
- [x] `{ provide: MAILER, useClass: process.env.NODE_ENV === 'test' ? FakeMailer : SmtpMailer }`
- [ ] Avec `@Global()` sur les deux classes
- [ ] En déclarant les deux classes dans `providers`
> Le choix de l'implémentation est centralisé dans la configuration du module ; le code métier dépend seulement du token. Pour une logique plus riche (lecture de `ConfigService`), on passe à `useFactory` avec `inject`.
[doc]: NestJS — Class providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers#class-providers-useclass
[doc]: NestJS — Class providers (FR) | https://docs.nest-js.fr/fundamentals/custom-providers

### Un module peut-il réexporter un module qu'il importe ?
- [ ] Non, seuls les providers peuvent être exportés
- [x] Oui : `exports: [CommonModule]` rend ses providers exportés disponibles aux importateurs
- [ ] Oui, mais seulement s'il est `@Global()`
- [ ] Non, cela crée une dépendance circulaire
> Le réexport permet de créer un module « façade » (ex. `CoreModule` qui réexporte `ConfigModule`, `LoggerModule`…). À garder simple : trop de réexports rendent les dépendances difficiles à suivre.
[doc]: NestJS — Module re-exporting (EN) | https://docs.nestjs.com/modules#module-re-exporting
[doc]: NestJS — Module re-exporting (FR) | https://docs.nest-js.fr/modules
