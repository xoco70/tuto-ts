---
id: nest-lifecycle
track: nestjs
order: 2
title: Cycle de requête - middleware, guards, interceptors, pipes, filters
level: Intermédiaire
summary: L'ordre exact d'exécution, le rôle de chaque brique, les niveaux de binding, ExecutionContext, Reflector et décorateurs personnalisés.
---

## L'ordre d'exécution

```
Requête
  → Middleware        (global puis module)
  → Guards            (global → controller → route)
  → Interceptors      (avant : global → controller → route)
  → Pipes             (global → controller → route → paramètre)
  → Handler du controller
  → Interceptors      (après : route → controller → global, via RxJS)
  → Exception filters (si erreur : route → controller → global, un seul gère)
Réponse
```

À retenir pour l'entretien : **M-G-I-P** (Middleware, Guards, Interceptors, Pipes).

## Rôle de chaque brique

| Brique | Question à laquelle elle répond | Retour |
| --- | --- | --- |
| Middleware | Pré-traitement brut (logs, cookies, CORS, body) | `next()` |
| Guard | « Cette requête a-t-elle le **droit** de passer ? » | `boolean` (false → 403) |
| Interceptor | Logique **autour** du handler (logs, cache, timeout, transformation de réponse) | `Observable` |
| Pipe | **Transformer / valider** les arguments | valeur transformée ou exception |
| Exception filter | Transformer une **exception** en réponse HTTP | réponse |

Le **middleware** n'a pas accès à l'`ExecutionContext` : il ne sait pas quel handler sera appelé, donc pas de métadonnées (`@Roles`). C'est pourquoi l'autorisation se fait dans un **guard**.

## Guards

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),   // métadonnée de la méthode d'abord
      context.getClass(),     // puis du controller
    ]);
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest();
    return roles.some((role) => user?.roles?.includes(role));
  }
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`ExecutionContext` abstrait le transport : `switchToHttp()`, `switchToWs()`, `switchToRpc()`, et `getType()`.

## Interceptors

```ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    return next.handle().pipe(
      map((data) => ({ data })),                       // enveloppe la réponse
      tap(() => console.log(`${Date.now() - start}ms`)),
      timeout(5000),
    );
  }
}
```

Ne pas appeler `next.handle()` = court-circuiter le handler (ex. réponse depuis le cache).

## Pipes

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}       // "abc" → 400 Bad Request

@Get()
list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {}
```

Pipes intégrés : `ValidationPipe`, `ParseIntPipe`, `ParseUUIDPipe`, `ParseBoolPipe`, `ParseArrayPipe`, `ParseEnumPipe`, `DefaultValuePipe`, `ParseFilePipe`.

## Exception filters

```ts
@Catch(EntityNotFoundError)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: EntityNotFoundError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(404).json({ message: 'Ressource introuvable' });
  }
}
```

Sans filtre, une `HttpException` (ou sous-classe : `NotFoundException`, `BadRequestException`…) est convertie en réponse avec son statut ; **toute autre erreur** → `500 Internal server error` (sans détail, volontairement).

## Niveaux de binding

```ts
@UseGuards(AuthGuard)          // sur une classe ou une méthode
@UseInterceptors(CacheInterceptor)
@UsePipes(new ValidationPipe())
@UseFilters(HttpExceptionFilter)

// global, sans DI :
app.useGlobalPipes(new ValidationPipe());

// global, AVEC DI (recommandé) :
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]   // APP_PIPE, APP_INTERCEPTOR, APP_FILTER
```

`app.useGlobalX(new X())` est créé **hors** du conteneur : impossible d'y injecter des dépendances. Les tokens `APP_*` règlent ce problème.

## Décorateurs personnalisés

```ts
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);

export function Auth(...roles: Role[]) {
  return applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard), ApiBearerAuth());
}
```

<!-- QUIZ -->

### Dans quel ordre s'exécutent ces briques pour une requête entrante ?
- [ ] Guards → Middleware → Pipes → Interceptors
- [x] Middleware → Guards → Interceptors → Pipes → Handler
- [ ] Pipes → Guards → Interceptors → Middleware
- [ ] Middleware → Pipes → Guards → Interceptors
> Moyen mnémotechnique : **M-G-I-P**. Les interceptors s'exécutent aussi *après* le handler (en ordre inverse) grâce à RxJS, et les exception filters interviennent en cas d'erreur.
[doc]: NestJS — Request lifecycle (EN) | https://docs.nestjs.com/faq/request-lifecycle

### Pourquoi implémenter un contrôle de rôles dans un guard plutôt qu'un middleware ?
- [ ] Les middlewares ne peuvent pas lire les headers
- [x] Le guard a accès à l'`ExecutionContext` : il sait quel handler va s'exécuter et peut lire ses métadonnées (`@Roles(...)`)
- [ ] Les middlewares s'exécutent après les guards
- [ ] Les guards sont plus rapides
> Un middleware ne sait pas quelle route sera appelée (il s'exécute avant le routage Nest). Un guard reçoit `context.getHandler()` et `context.getClass()`, indispensables pour lire les métadonnées via `Reflector`.
[doc]: NestJS — Guards (EN) | https://docs.nestjs.com/guards

### Qu'arrive-t-il si un guard retourne `false` ?
- [ ] La requête passe quand même au handler
- [ ] Nest renvoie 401 Unauthorized
- [x] Nest lève une `ForbiddenException` (403)
- [ ] Nest renvoie 404
> Par défaut un guard qui refuse produit un 403. Pour un 401 (non authentifié), le guard doit lever lui-même une `UnauthorizedException` — c'est ce que fait `AuthGuard('jwt')` de `@nestjs/passport`.
[doc]: NestJS — Guards, putting it all together (EN) | https://docs.nestjs.com/guards#putting-it-all-together

### Pourquoi préférer `{ provide: APP_GUARD, useClass: JwtAuthGuard }` à `app.useGlobalGuards(new JwtAuthGuard())` ?
- [ ] `useGlobalGuards` n'existe pas
- [x] Avec `APP_GUARD`, le guard est instancié par le conteneur et peut recevoir des dépendances (Reflector, services)
- [ ] `APP_GUARD` ne s'applique qu'à un module
- [ ] `useGlobalGuards` désactive les autres guards
> Un objet créé avec `new` dans `main.ts` vit hors du conteneur DI. Les tokens `APP_GUARD`, `APP_PIPE`, `APP_INTERCEPTOR`, `APP_FILTER` enregistrent un provider global avec injection. Ils s'appliquent à toute l'app quel que soit le module où ils sont déclarés.
[doc]: NestJS — Binding guards (EN) | https://docs.nestjs.com/guards#binding-guards

### Que renvoie Nest si un service lève `new Error('boom')` sans filtre personnalisé ?
- [ ] 400 avec le message `boom`
- [x] 500 avec `{ statusCode: 500, message: 'Internal server error' }`
- [ ] Le processus crashe
- [ ] 200 avec un body vide
> Le filtre global intégré convertit toute exception non-`HttpException` en 500 générique, sans divulguer le message (bonne pratique de sécurité). Pour un 404 métier : `throw new NotFoundException()`, ou un filtre qui mappe vos erreurs de domaine.
[doc]: NestJS — Exception filters (EN) | https://docs.nestjs.com/exception-filters

### Que se passe-t-il avec `@Param('id', ParseIntPipe) id: number` si on appelle `/users/abc` ?
- [ ] `id` vaut `NaN`
- [ ] `id` vaut `'abc'`
- [x] Le pipe lève une `BadRequestException` (400) et le handler n'est pas appelé
- [ ] Nest renvoie 404
> Les pipes s'exécutent avant le handler : une conversion impossible lève une exception. Sans pipe, `id` serait la chaîne `'abc'` malgré l'annotation `number` (les types ne convertissent rien).
[doc]: NestJS — Pipes, built-in pipes (EN) | https://docs.nestjs.com/pipes#built-in-pipes

### Quel est l'outil adapté pour envelopper toutes les réponses dans `{ data: ... }` et mesurer leur durée ?
- [ ] Un guard
- [ ] Un pipe
- [x] Un interceptor
- [ ] Un middleware
> L'interceptor encadre l'exécution du handler et manipule le flux de réponse via RxJS (`next.handle().pipe(map(...))`). Le middleware ne voit pas la valeur retournée par le handler.
[doc]: NestJS — Interceptors (EN) | https://docs.nestjs.com/interceptors

### Que fait un interceptor qui retourne `of(cached)` sans appeler `next.handle()` ?
- [ ] Erreur : `next.handle()` est obligatoire
- [x] Il court-circuite le handler : la valeur en cache est renvoyée directement
- [ ] Il appelle le handler puis renvoie le cache
- [ ] Il renvoie une réponse vide
> C'est le principe du `CacheInterceptor`. Sans `next.handle()`, ni le handler ni les pipes ne s'exécutent.
[doc]: NestJS — Interceptors, response mapping (EN) | https://docs.nestjs.com/interceptors#stream-overriding

### Que retourne `reflector.getAllAndOverride(ROLES_KEY, [context.getHandler(), context.getClass()])` ?
- [ ] La fusion des rôles de la méthode et du controller
- [x] La métadonnée de la méthode si elle existe, sinon celle du controller
- [ ] Toujours celle du controller
- [ ] Un tableau de tableaux
> `getAllAndOverride` prend la **première** valeur définie dans l'ordre des cibles : la méthode surcharge le controller. `getAllAndMerge` fusionnerait les deux.
[doc]: NestJS — Execution context, Reflection and metadata (EN) | https://docs.nestjs.com/fundamentals/execution-context#reflection-and-metadata

### Comment créer un décorateur `@CurrentUser()` qui injecte `req.user` dans un paramètre de handler ?
- [ ] `SetMetadata('user', req.user)`
- [x] `createParamDecorator((data, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user)`
- [ ] Un middleware qui modifie les arguments
- [ ] `@Inject(REQUEST)` dans le controller
> `createParamDecorator` reçoit l'argument passé au décorateur (`data`) et le contexte. Les décorateurs de paramètres personnalisés peuvent aussi recevoir des pipes : `@CurrentUser(new ValidationPipe())`.
[doc]: NestJS — Custom route decorators (EN) | https://docs.nestjs.com/custom-decorators

### À quoi sert `applyDecorators` ?
- [ ] À appliquer un décorateur à toutes les routes
- [x] À composer plusieurs décorateurs en un seul (ex. `@Auth('admin')` = `@Roles` + `@UseGuards` + `@ApiBearerAuth`)
- [ ] À appliquer un décorateur au runtime
- [ ] À créer un décorateur de paramètre
> Réduit la répétition et centralise la politique de sécurité : un seul décorateur à apposer, impossible d'oublier un guard.
[doc]: NestJS — Decorator composition (EN) | https://docs.nestjs.com/custom-decorators#decorator-composition

### Un filtre est défini au niveau route et un autre en global, tous deux capables de traiter l'exception. Lequel la gère ?
- [ ] Le global
- [x] Celui de la route (le plus spécifique) — un seul filtre traite l'exception
- [ ] Les deux, dans l'ordre global puis route
- [ ] Celui déclaré en dernier
> Les filtres sont résolus du plus spécifique au plus général (route → controller → global), et le premier qui correspond (`@Catch(...)`) gère l'exception. Les filtres ne se chaînent pas.
[doc]: NestJS — Binding filters (EN) | https://docs.nestjs.com/exception-filters#binding-filters

### Comment un guard récupère-t-il l'objet requête quelle que soit l'origine (HTTP, WebSocket, microservice) ?
- [ ] Via `@Req()`
- [x] Via `ExecutionContext` : `context.getType()` puis `switchToHttp()`, `switchToWs()` ou `switchToRpc()`
- [ ] Via `process.request`
- [ ] Ce n'est pas possible : les guards sont HTTP uniquement
> `ExecutionContext` (qui étend `ArgumentsHost`) rend guards, interceptors et filtres **agnostiques du transport**. Pour GraphQL : `GqlExecutionContext.create(context)`.
[doc]: NestJS — Execution context (EN) | https://docs.nestjs.com/fundamentals/execution-context

### Quelles tâches relèvent typiquement d'un interceptor ? (plusieurs réponses)
- [x] Mettre en cache une réponse
- [x] Appliquer un timeout au handler
- [x] Transformer une exception en une autre via `catchError`
- [ ] Valider le body de la requête avec class-validator
> Les interceptors gèrent la logique transverse autour de l'appel (cache, logs, timeout, mapping de réponse ou d'erreurs). La validation des arguments est le rôle des **pipes**.
[doc]: NestJS — Interceptors (EN) | https://docs.nestjs.com/interceptors
