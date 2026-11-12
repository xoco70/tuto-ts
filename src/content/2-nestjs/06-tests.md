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
[doc]: NestJS — Database, testing (FR) | https://docs.nest-js.fr/techniques/database

### Que fait `.overrideProvider(PaymentGateway).useValue(fake)` ?
- [ ] Il ajoute un second provider `PaymentGateway`
- [x] Il remplace l'implémentation de `PaymentGateway` dans tout le graphe du module de test, même si elle vient d'un module importé
- [ ] Il modifie le code de production
- [ ] Il ne fonctionne qu'en e2e
> `overrideProvider` agit sur le conteneur compilé, idéal pour remplacer une dépendance externe (paiement, mail) tout en gardant le reste de l'application réelle.
[doc]: NestJS — Testing (EN) | https://docs.nestjs.com/fundamentals/testing
[doc]: NestJS — Testing (FR) | https://docs.nest-js.fr/fundamentals/testing

### Un test e2e renvoie 201 alors que le body est invalide, alors qu'en local l'API renvoie 400. Cause probable ?
- [ ] Supertest désactive la validation
- [x] Le `ValidationPipe` est enregistré dans `main.ts` via `useGlobalPipes`, ce qui n'est pas exécuté par `createNestApplication()` dans le test
- [ ] Les tests e2e n'utilisent pas les DTO
- [ ] Le body n'est pas envoyé en JSON par défaut
> `main.ts` n'est pas exécuté en test. Il faut reproduire la configuration (fonction `setupApp(app)` partagée) ou déclarer le pipe via `APP_PIPE` dans un module.
[doc]: NestJS — End-to-end testing (EN) | https://docs.nestjs.com/fundamentals/testing#end-to-end-testing
[doc]: NestJS — End-to-end testing (FR) | https://docs.nest-js.fr/fundamentals/testing

### Pourquoi appeler `app.close()` dans `afterAll` ?
- [ ] Pour vider les mocks
- [x] Pour fermer le serveur et les connexions (DB, Redis…) : sinon Jest ne se termine pas (« open handles ») et les ressources fuient
- [ ] C'est facultatif
- [ ] Pour générer le rapport de couverture
> `close()` déclenche les hooks `onModuleDestroy`/`onApplicationShutdown`. Sans cela : connexions ouvertes, warnings `--detectOpenHandles`, flakiness.
[doc]: NestJS — Testing (EN) | https://docs.nestjs.com/fundamentals/testing#end-to-end-testing
[doc]: NestJS — Testing (FR) | https://docs.nest-js.fr/fundamentals/testing

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
[doc]: NestJS — Overriding globally registered enhancers (FR) | https://docs.nest-js.fr/fundamentals/testing

### Pourquoi l'injection de dépendances échoue-t-elle en passant de Jest (ts-jest) à Vitest (esbuild) sans configuration ?
- [ ] Vitest ne supporte pas les classes
- [x] esbuild n'émet pas les métadonnées de décorateurs (`emitDecoratorMetadata`) : Nest ne connaît plus les types des paramètres du constructeur
- [ ] Vitest exécute les tests en parallèle
- [ ] NestJS est incompatible avec ESM
> Il faut utiliser swc (`unplugin-swc`), qui sait émettre ces métadonnées. Le CLI Nest propose aussi `swc` comme builder (`nest start -b swc`), avec `typeCheck` séparé.
[doc]: NestJS — SWC, Vitest (EN) | https://docs.nestjs.com/recipes/swc#vitest
[doc]: NestJS — SWC, Vitest (FR) | https://docs.nest-js.fr/recipes/swc

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
[doc]: NestJS — Testing (FR) | https://docs.nest-js.fr/fundamentals/testing

### Quelle est la différence entre `jest.fn()` et `jest.spyOn(objet, 'methode')` ?
- [ ] Aucune
- [x] `spyOn` observe une méthode existante (en appelant l'implémentation réelle par défaut) et peut être restaurée
- [ ] `spyOn` ne fonctionne qu'avec des classes
- [ ] `jest.fn()` appelle toujours l'implémentation réelle
> `jest.fn()` crée une fonction factice à partir de rien. `jest.spyOn` remplace une méthode d'un objet réel tout en enregistrant les appels ; `mockRestore()` remet l'original. On peut ensuite surcharger avec `.mockResolvedValue()`.
[doc]: Jest — jest.spyOn (EN) | https://jestjs.io/docs/jest-object#jestspyonobject-methodname

### Comment obtenir dans un test une instance d'un provider `Scope.REQUEST` ?
- [ ] `moduleRef.get(Service)`
- [x] `await moduleRef.resolve(Service)`
- [ ] `new Service()`
- [ ] Ce n'est pas testable
> `get()` ne fonctionne que pour les providers statiques (singleton). Pour un provider request-scoped ou transient, `resolve()` crée une instance dans un sous-arbre d'injection ; deux appels renvoient deux instances différentes, sauf si l'on passe le même `contextId`.
[doc]: NestJS — Testing request-scoped instances (EN) | https://docs.nestjs.com/fundamentals/testing#testing-request-scoped-instances
[doc]: NestJS — Testing request-scoped instances (FR) | https://docs.nest-js.fr/fundamentals/testing

### Quelle est la différence entre `mockClear()`, `mockReset()` et `mockRestore()` ?
- [ ] Ce sont des alias
- [x] `clear` efface l'historique des appels ; `reset` efface aussi l'implémentation ; `restore` remet en plus la méthode originale d'un `spyOn`
- [ ] `restore` efface l'historique, `clear` remet l'original
- [ ] `reset` n'existe que pour les timers
> Les options `clearMocks`, `resetMocks` ou `restoreMocks` dans la config Jest les appliquent automatiquement avant chaque test. Elles évitent que l'état d'un mock déborde sur le test suivant.
[doc]: Jest — Mock functions API (EN) | https://jestjs.io/docs/mock-function-api#mockfnmockclear

### Des tests d'intégration partagent une même base PostgreSQL et échouent aléatoirement. Quelle mesure est la plus simple pour commencer ?
- [ ] Ajouter des `setTimeout` entre les tests
- [x] Exécuter les fichiers en série (`jest --runInBand`) ou donner une base / un schéma par worker
- [ ] Désactiver les transactions
- [ ] Relancer la suite jusqu'à ce qu'elle passe
> Par défaut, Jest exécute les fichiers en parallèle dans plusieurs workers : deux fichiers qui vident les mêmes tables se marchent dessus. On sérialise, ou on isole par worker grâce à `JEST_WORKER_ID`.
[doc]: Jest — CLI --runInBand (EN) | https://jestjs.io/docs/cli#--runinband

### Que décrit le schéma « Arrange / Act / Assert » ?
- [ ] Les trois niveaux de la pyramide de tests
- [x] La structure d'un test : préparer le contexte, exécuter l'action testée, vérifier le résultat
- [ ] Les trois hooks `beforeAll`, `it`, `afterAll`
- [ ] Les étapes d'une revue de code
> Un test lisible a une seule action et des assertions qui s'y rapportent. Si la partie « Arrange » devient énorme, c'est souvent un signal que l'unité testée a trop de dépendances.
[doc]: Martin Fowler — Given When Then (EN) | https://martinfowler.com/bliki/GivenWhenThen.html

### Qu'apporte un test de contrat (ex. Pact) entre un front et une API ?
- [ ] Il remplace les tests unitaires
- [x] Il vérifie que le fournisseur respecte les attentes exprimées par le consommateur, sans déployer les deux ensemble
- [ ] Il mesure les performances de l'API
- [ ] Il génère la documentation OpenAPI
> Le consommateur enregistre les interactions dont il dépend ; le fournisseur les rejoue dans sa CI. On détecte un changement cassant avant le déploiement, sans environnement e2e partagé et fragile.
[doc]: Pact — Introduction (EN) | https://docs.pact.io/

### Quelle répartition de tests le « testing trophy » de Kent C. Dodds met-il en avant pour une application web ?
- [ ] Une majorité de tests e2e
- [x] Une majorité de tests d'intégration, appuyés par l'analyse statique, des tests unitaires et quelques tests e2e
- [ ] Uniquement des tests unitaires
- [ ] Autant de tests de chaque type
> L'idée : les tests d'intégration offrent le meilleur rapport confiance / coût. L'analyse statique (TypeScript, ESLint) forme la base du trophée et attrape une classe entière d'erreurs gratuitement.
[doc]: Kent C. Dodds — The Testing Trophy (EN) | https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications

### Un test passe même quand on supprime la ligne de code métier qu'il est censé couvrir. Quel outil détecte ce genre de test faible ?
- [ ] La couverture de code (`--coverage`)
- [x] Le *mutation testing* (ex. Stryker)
- [ ] Le linter
- [ ] Les snapshots
> La couverture dit seulement qu'une ligne a été **exécutée**. Le mutation testing modifie le code (inverse une condition, supprime un appel) et vérifie qu'au moins un test échoue : un « mutant survivant » révèle une assertion manquante.
[doc]: Stryker — Introduction (EN) | https://stryker-mutator.io/docs/
