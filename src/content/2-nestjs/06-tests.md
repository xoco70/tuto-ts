---
id: nest-tests
track: nestjs
order: 6
title: Tester une application NestJS
level: Intermédiaire
summary: Tests unitaires avec TestingModule, mocks et overrideProvider, tests e2e avec Supertest, stratégie de tests, Testcontainers.
---

## La pyramide (ou le trophée)

- **Unitaires** : une classe isolée, dépendances mockées. Rapides, nombreux.
- **Intégration** : plusieurs briques réelles (service + vraie base). Le meilleur rapport confiance / coût pour un backend.
- **E2E** : l'application HTTP complète via Supertest.

Tester le **comportement** (entrées → sorties, effets) plutôt que l'implémentation (quelle méthode privée a été appelée).

## Test unitaire avec `Test.createTestingModule`

```ts
describe('OrdersService', () => {
  let service: OrdersService;
  const repo = { findOneBy: jest.fn(), save: jest.fn() };
  const mailer = { send: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: repo },
        { provide: Mailer, useValue: mailer },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
    jest.clearAllMocks();
  });

  it('lève NotFoundException si la commande est inconnue', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.confirm('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
```

- `getRepositoryToken(Order)` donne le token utilisé par `@InjectRepository(Order)`.
- `useMocker(createMock)` (avec `@golevelup/ts-jest`) mocke automatiquement toutes les dépendances manquantes.
- Pour une classe sans DI complexe, `new OrdersService(repo as any, mailer as any)` suffit souvent.

## Remplacer un provider

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PaymentGateway).useValue(fakeGateway)
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
  .compile();
```

`overrideProvider`, `overrideGuard`, `overrideInterceptor`, `overridePipe`, `overrideFilter`, `overrideModule`.

## Tests e2e

```ts
describe('Orders (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));   // ⚠️ reproduire la config de main.ts
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /orders refuse un body invalide', () =>
    request(app.getHttpServer()).post('/orders').send({ qty: -1 }).expect(400));
});
```

Piège classique : ce qui est configuré dans `main.ts` (`useGlobalPipes`, préfixe, versioning…) **n'est pas** appliqué par `createNestApplication()`. Solutions : une fonction `configureApp(app)` partagée, ou des `APP_PIPE`/`APP_GUARD` déclarés dans les modules.

## Base de données en test

- **Testcontainers** : un vrai PostgreSQL éphémère par suite.
- Isoler chaque test : transaction annulée à la fin, `TRUNCATE` entre les tests, ou schéma dédié.
- Fixtures via des **factories** (`buildUser({ role: 'admin' })`) plutôt que des JSON figés.

## Mocks : à doser

- Mocker les **frontières** (HTTP externe, horloge, email, paiement) ; garder le reste réel autant que possible.
- `jest.useFakeTimers()` / `jest.setSystemTime()` pour le temps.
- `nock` ou **MSW** pour intercepter les appels HTTP sortants.
- Trop de mocks = tests qui passent alors que l'intégration est cassée.

## Vitest

De plus en plus de projets Nest migrent de Jest à **Vitest** (plus rapide, ESM natif). Attention : esbuild n'émet pas `emitDecoratorMetadata` → il faut le plugin **swc** (`unplugin-swc`) pour que l'injection fonctionne.

<!-- QUIZ -->

### Quel token utiliser pour mocker un repository injecté via `@InjectRepository(User)` ?
- [ ] `Repository<User>`
- [ ] `'UserRepository'`
- [x] `getRepositoryToken(User)`
- [ ] `User`
> `@InjectRepository(User)` est un raccourci pour `@Inject(getRepositoryToken(User))`. Dans le module de test : `{ provide: getRepositoryToken(User), useValue: mockRepo }`.
[doc]: NestJS — Database, testing (EN) | https://docs.nestjs.com/techniques/database#testing

### Que fait `.overrideProvider(PaymentGateway).useValue(fake)` ?
- [ ] Il ajoute un second provider `PaymentGateway`
- [x] Il remplace l'implémentation de `PaymentGateway` dans tout le graphe du module de test, même si elle vient d'un module importé
- [ ] Il modifie le code de production
- [ ] Il ne fonctionne qu'en e2e
> `overrideProvider` agit sur le conteneur compilé, idéal pour remplacer une dépendance externe (paiement, mail) tout en gardant le reste de l'application réelle.
[doc]: NestJS — Testing (EN) | https://docs.nestjs.com/fundamentals/testing

### Un test e2e renvoie 201 alors que le body est invalide, alors qu'en local l'API renvoie 400. Cause probable ?
- [ ] Supertest désactive la validation
- [x] Le `ValidationPipe` est enregistré dans `main.ts` via `useGlobalPipes`, ce qui n'est pas exécuté par `createNestApplication()` dans le test
- [ ] Les tests e2e n'utilisent pas les DTO
- [ ] Le body n'est pas envoyé en JSON par défaut
> `main.ts` n'est pas exécuté en test. Il faut reproduire la configuration (fonction `setupApp(app)` partagée) ou déclarer le pipe via `APP_PIPE` dans un module.
[doc]: NestJS — End-to-end testing (EN) | https://docs.nestjs.com/fundamentals/testing#end-to-end-testing

### Pourquoi appeler `app.close()` dans `afterAll` ?
- [ ] Pour vider les mocks
- [x] Pour fermer le serveur et les connexions (DB, Redis…) : sinon Jest ne se termine pas (« open handles ») et les ressources fuient
- [ ] C'est facultatif
- [ ] Pour générer le rapport de couverture
> `close()` déclenche les hooks `onModuleDestroy`/`onApplicationShutdown`. Sans cela : connexions ouvertes, warnings `--detectOpenHandles`, flakiness.
[doc]: NestJS — Testing (EN) | https://docs.nestjs.com/fundamentals/testing#end-to-end-testing

### Qu'est-ce qu'il vaut mieux tester dans un test unitaire de service ?
- [ ] Que chaque méthode privée est appelée dans le bon ordre
- [x] Le comportement observable : valeur retournée, exceptions levées, effets sur les dépendances aux frontières
- [ ] Le nombre de lignes exécutées
- [ ] L'implémentation interne de l'ORM
> Les tests liés à l'implémentation cassent à chaque refactoring sans détecter de bug. Tester le contrat permet de refactorer en confiance.
[doc]: Kent C. Dodds — Testing implementation details (EN) | https://kentcdodds.com/blog/testing-implementation-details

### Comment tester une logique qui dépend de la date du jour (ex. expiration à 30 jours) ?
- [ ] Attendre 30 jours
- [x] Contrôler l'horloge : `jest.useFakeTimers()` + `jest.setSystemTime(...)`, ou injecter un provider `Clock`
- [ ] Modifier l'heure de la machine de CI
- [ ] Ne pas tester ce cas
> Le temps est une dépendance cachée. L'injecter (ou le simuler) rend le test déterministe. Penser à `jest.useRealTimers()` après le test.
[doc]: Jest — Fake timers (EN) | https://jestjs.io/docs/timer-mocks

### Quel outil permet d'exécuter les tests d'intégration contre un vrai PostgreSQL éphémère ?
- [ ] Supertest
- [x] Testcontainers
- [ ] Nock
- [ ] Jest snapshots
> Testcontainers démarre un conteneur Docker par suite de tests et le détruit ensuite. On applique les migrations au démarrage pour tester le vrai schéma.
[doc]: Testcontainers — PostgreSQL module (EN) | https://node.testcontainers.org/modules/postgresql/

### Comment désactiver l'authentification dans un test e2e qui ne la concerne pas ?
- [ ] Supprimer `@UseGuards` du controller
- [x] `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`
- [ ] Mettre `NODE_ENV=test` dans le guard
- [ ] Ce n'est pas possible
> On peut aussi injecter un faux utilisateur : `canActivate: (ctx) => { ctx.switchToHttp().getRequest().user = fakeUser; return true; }`. Garder quelques tests e2e avec l'auth réelle.
[doc]: NestJS — Overriding globally registered enhancers (EN) | https://docs.nestjs.com/fundamentals/testing#overriding-globally-registered-enhancers

### Pourquoi l'injection de dépendances échoue-t-elle en passant de Jest (ts-jest) à Vitest (esbuild) sans configuration ?
- [ ] Vitest ne supporte pas les classes
- [x] esbuild n'émet pas les métadonnées de décorateurs (`emitDecoratorMetadata`) : Nest ne connaît plus les types des paramètres du constructeur
- [ ] Vitest exécute les tests en parallèle
- [ ] NestJS est incompatible avec ESM
> Il faut utiliser swc (`unplugin-swc`), qui sait émettre ces métadonnées. Le CLI Nest propose aussi `swc` comme builder (`nest start -b swc`), avec `typeCheck` séparé.
[doc]: NestJS — SWC, Vitest (EN) | https://docs.nestjs.com/recipes/swc#vitest

### Quelle est la différence entre `jest.fn().mockResolvedValue(x)` et `jest.fn().mockReturnValue(x)` ?
- [ ] Aucune
- [x] `mockResolvedValue` retourne une Promise résolue avec `x` ; `mockReturnValue` retourne `x` directement
- [ ] `mockResolvedValue` lève une erreur
- [ ] `mockReturnValue` est asynchrone
> `mockResolvedValue(x)` équivaut à `mockImplementation(() => Promise.resolve(x))`, et `mockRejectedValue(e)` à un rejet. Indispensable pour mocker des méthodes `async` d'un repository.
[doc]: Jest — Mock functions API (EN) | https://jestjs.io/docs/mock-function-api#mockfnmockresolvedvaluevalue

### Quel est le principal risque d'une suite de tests où tout est mocké ?
- [ ] Les tests sont trop lents
- [x] Les tests passent alors que les briques réelles ne s'intègrent pas (requête SQL fausse, contrat d'API changé…)
- [ ] La couverture est trop faible
- [ ] Il n'y en a aucun
> Les mocks figent des hypothèses. On mocke les frontières externes et on complète par des tests d'intégration réels pour les interactions critiques (DB, queues).
[doc]: Martin Fowler — Mocks Aren't Stubs (EN) | https://martinfowler.com/articles/mocksArentStubs.html

### Comment intercepter un appel HTTP sortant vers une API tierce dans un test d'intégration ?
- [ ] En coupant Internet sur la machine
- [x] Avec `nock` ou MSW, qui interceptent les requêtes au niveau du client HTTP de Node
- [ ] En modifiant `/etc/hosts`
- [ ] Avec `jest.mock('http')` uniquement
> Ces outils permettent de simuler réponses, erreurs et timeouts de façon déterministe, et de vérifier qu'aucun appel imprévu n'est fait.
[doc]: MSW — Node.js integration (EN) | https://mswjs.io/docs/integrations/node

### Quelles pratiques rendent des tests d'intégration fiables et indépendants ? (plusieurs réponses)
- [x] Réinitialiser l'état de la base entre les tests (transaction annulée ou TRUNCATE)
- [x] Créer les données avec des factories
- [ ] Faire dépendre chaque test du résultat du précédent
- [x] Contrôler l'horloge et les appels externes
> Des tests interdépendants échouent en cascade et ne peuvent pas tourner en parallèle ou dans un ordre aléatoire.
[doc]: NestJS — Testing (EN) | https://docs.nestjs.com/fundamentals/testing
