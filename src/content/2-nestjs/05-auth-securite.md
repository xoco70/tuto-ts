---
id: nest-auth
track: nestjs
order: 5
title: Authentification, autorisation et sécurité
level: Avancé
summary: JWT et refresh tokens, Passport, guards globaux et @Public, RBAC / ABAC, hachage, rate limiting, helmet, CORS.
---

## Authentification vs autorisation

- **Authentification** : *qui es-tu ?* → 401 Unauthorized si échec.
- **Autorisation** : *as-tu le droit ?* → 403 Forbidden si échec.

## JWT

Un JWT = `header.payload.signature` en base64url. Le payload est **lisible par tous** (encodé, pas chiffré) : jamais de données sensibles dedans. La signature garantit seulement qu'il n'a pas été modifié.

```ts
@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException();          // même message dans les deux cas
    }
    return { access_token: await this.jwt.signAsync({ sub: user.id, roles: user.roles }) };
  }
}
```

### Access token + refresh token

| | Access token | Refresh token |
| --- | --- | --- |
| Durée | courte (5–15 min) | longue (jours) |
| Stockage côté client | mémoire | cookie `HttpOnly; Secure; SameSite` |
| Côté serveur | stateless | **stocké (haché)** pour pouvoir le révoquer |

**Rotation** : à chaque refresh, on émet un nouveau refresh token et on invalide l'ancien ; la réutilisation d'un ancien token signale un vol → révoquer toute la famille.

Stocker un token en `localStorage` l'expose à toute faille **XSS**. Un cookie `HttpOnly` n'est pas lisible en JS, mais impose une protection **CSRF** (`SameSite`, token CSRF).

## Passport dans Nest

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }
  validate(payload: { sub: string; roles: Role[] }) {
    return { id: payload.sub, roles: payload.roles };   // devient req.user
  }
}

@UseGuards(AuthGuard('jwt'))
@Get('me') me(@CurrentUser() user: AuthUser) { return user; }
```

### Guard global + `@Public()`

Sécurisé **par défaut** plutôt que d'oublier un `@UseGuards` :

```ts
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    return isPublic ? true : super.canActivate(ctx);
  }
}
// providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

## Autorisation

- **RBAC** (rôles) : `@Roles('admin')` + `RolesGuard`.
- **ABAC / propriété** : « un utilisateur ne peut modifier **que ses** commandes ». Un rôle ne suffit pas : il faut vérifier la ressource (`order.userId === user.id`). Oublier ce contrôle = **IDOR / BOLA**, la faille n°1 du Top 10 OWASP API.
- CASL (`@casl/ability`) structure les règles fines.

## Mots de passe

- Hachage **lent et salé** : `argon2id` (recommandé) ou `bcrypt` (attention : tronque à 72 octets). Jamais MD5/SHA-256 seul.
- Comparaison via la fonction de vérification de la lib (temps constant).

## Durcissement HTTP

```ts
app.use(helmet());                                    // en-têtes de sécurité
app.enableCors({ origin: ['https://app.exemple.fr'], credentials: true });
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]); // + APP_GUARD ThrottlerGuard
```

- `origin: '*'` est **incompatible** avec `credentials: true` : le navigateur refuse.
- CORS n'est **pas** une protection côté serveur : il dit au **navigateur** quelles origines peuvent lire la réponse. `curl` l'ignore.
- Rate limiting sur `/login`, `/forgot-password` contre le brute force.
- Les secrets dans l'environnement / un gestionnaire de secrets, validés au démarrage.

<!-- QUIZ -->

### Quelle est la différence entre une réponse 401 et une réponse 403 ?
- [ ] Aucune, ce sont des synonymes
- [x] 401 : non authentifié (identité inconnue ou invalide) ; 403 : authentifié mais sans le droit d'accéder
- [ ] 401 : ressource introuvable ; 403 : serveur en panne
- [ ] 403 : non authentifié ; 401 : non autorisé
> Malgré son nom « Unauthorized », 401 concerne l'**authentification**. Certaines API renvoient 404 plutôt que 403 pour ne pas révéler l'existence d'une ressource.
[doc]: MDN — 401 Unauthorized | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Status/401

### Que peut lire un attaquant qui intercepte un JWT signé (non chiffré) ?
- [ ] Rien, il est chiffré
- [x] Tout le payload : il est simplement encodé en base64url
- [ ] Uniquement le header
- [ ] Uniquement la date d'expiration
> Un JWT signé (JWS) garantit l'**intégrité**, pas la **confidentialité**. Ne jamais y mettre d'information sensible. Le chiffrement nécessiterait un JWE.
[doc]: jwt.io — Introduction (EN) | https://jwt.io/introduction

### Où est-il préférable de stocker un refresh token dans une application web ?
- [ ] Dans `localStorage`
- [ ] Dans le payload de l'access token
- [x] Dans un cookie `HttpOnly`, `Secure`, `SameSite`, avec un chemin restreint à l'endpoint de refresh
- [ ] Dans l'URL
> Un cookie `HttpOnly` n'est pas accessible au JavaScript : une faille XSS ne permet pas de le voler. En contrepartie, il faut se protéger du CSRF (`SameSite=Strict/Lax`, vérification d'origine).
[doc]: OWASP — JWT Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html

### Pourquoi un JWT stateless pose-t-il un problème de révocation ?
- [ ] Il ne peut pas expirer
- [x] Le serveur ne garde pas d'état : un token volé reste valide jusqu'à son expiration, sauf liste de révocation
- [ ] Il est trop long
- [ ] Il nécessite une base de données à chaque requête
> D'où les access tokens à durée courte, les refresh tokens stockés côté serveur (révocables), et éventuellement une *denylist* (Redis) des `jti` révoqués.
[doc]: OWASP — JWT Cheat Sheet, token revocation (EN) | https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html

### Dans une `PassportStrategy`, que devient la valeur retournée par `validate()` ?
- [ ] Le body de la réponse
- [x] Elle est attachée à `req.user`
- [ ] Elle est stockée dans la session automatiquement
- [ ] Elle est ignorée
> Passport appelle `validate` après vérification de la signature/expiration du JWT. Le retour (ou une exception) détermine l'authentification ; on y charge souvent l'utilisateur ou on vérifie qu'il n'est pas désactivé.
[doc]: NestJS — Passport (EN) | https://docs.nestjs.com/recipes/passport

### Quel est l'intérêt d'un guard JWT global avec un décorateur `@Public()` ?
- [ ] Les performances
- [x] Sécurité par défaut : toute nouvelle route est protégée, et il faut explicitement la marquer publique
- [ ] Cela évite d'utiliser Passport
- [ ] Cela permet de ne pas signer les tokens
> Avec `@UseGuards` route par route, un oubli expose une route. L'approche inverse (*secure by default*) réduit le risque humain.
[doc]: NestJS — Enable authentication globally (EN) | https://docs.nestjs.com/security/authentication#enable-authentication-globally

### `GET /orders/:id` vérifie seulement que l'utilisateur est authentifié. Quelle faille est présente ?
- [ ] Injection SQL
- [ ] XSS
- [x] IDOR / BOLA : un utilisateur peut lire la commande d'un autre en changeant l'id
- [ ] CSRF
> *Broken Object Level Authorization* est la faille n°1 de l'OWASP API Top 10. Il faut vérifier l'appartenance (`WHERE id = :id AND user_id = :userId`) ou une règle d'accès sur la ressource.
[doc]: OWASP API Security — API1:2023 BOLA (EN) | https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

### Quel algorithme utiliser pour hacher des mots de passe ?
- [ ] SHA-256
- [ ] MD5 avec un sel
- [x] Argon2id (ou bcrypt / scrypt)
- [ ] AES-256
> Les mots de passe nécessitent une fonction **lente** et salée, résistante au brute force GPU. SHA-256 est trop rapide ; AES est du chiffrement réversible, pas du hachage.
[doc]: OWASP — Password Storage Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Pourquoi renvoyer le même message d'erreur pour « email inconnu » et « mot de passe incorrect » ?
- [ ] Pour simplifier le code
- [x] Pour ne pas permettre l'énumération des comptes existants
- [ ] Parce que Passport l'impose
- [ ] Pour des raisons de performance
> Des messages différents permettent de tester quels emails sont inscrits. Idéalement, le temps de réponse doit aussi être similaire (hacher même quand l'utilisateur n'existe pas).
[doc]: OWASP — Authentication Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-and-error-messages

### Que fait réellement la configuration CORS d'un serveur ?
- [ ] Elle bloque les requêtes venant de `curl` ou Postman
- [x] Elle indique au **navigateur** quelles origines ont le droit de lire les réponses ; elle ne protège pas le serveur des clients non-navigateurs
- [ ] Elle chiffre les échanges
- [ ] Elle empêche les attaques CSRF
> CORS assouplit la *Same-Origin Policy* du navigateur. Un script ou un serveur peut appeler l'API sans contrainte CORS : l'authentification et l'autorisation restent indispensables.
[doc]: MDN — CORS | https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CORS

### Pourquoi `enableCors({ origin: '*', credentials: true })` ne fonctionne-t-il pas ?
- [ ] Nest n'accepte pas `'*'`
- [x] Les navigateurs refusent `Access-Control-Allow-Origin: *` pour les requêtes avec cookies / credentials
- [ ] `credentials` n'existe pas
- [ ] Cela fonctionne parfaitement
> Avec credentials, l'origine doit être explicite. Il faut lister les origines autorisées (ou une fonction de validation), jamais refléter aveuglément l'en-tête `Origin` reçu.
[doc]: MDN — CORS et credentials | https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CORS#requêtes_avec_informations_dauthentification

### Quel module NestJS protège `/auth/login` contre le brute force ?
- [ ] `@nestjs/helmet`
- [x] `@nestjs/throttler` (avec `ThrottlerGuard`)
- [ ] `@nestjs/cors`
- [ ] `@nestjs/jwt`
> Le throttler limite le nombre de requêtes par fenêtre de temps (`@Throttle()` pour affiner par route). Derrière un proxy, configure `trust proxy` pour lire la vraie IP, et utilise un stockage partagé (Redis) si plusieurs instances.
[doc]: NestJS — Rate limiting (EN) | https://docs.nestjs.com/security/rate-limiting

### Quelle mesure est la plus efficace en cas de détection de réutilisation d'un refresh token déjà utilisé (rotation) ?
- [ ] L'ignorer
- [ ] Émettre un nouveau token quand même
- [x] Révoquer toute la famille de tokens de cette session et forcer une reconnexion
- [ ] Bloquer définitivement le compte
> La réutilisation d'un refresh token « consommé » signifie qu'un attaquant (ou la victime) détient une copie. Révoquer toute la chaîne coupe l'accès à l'attaquant.
[doc]: OAuth 2.0 Security BCP — Refresh token rotation (EN) | https://datatracker.ietf.org/doc/html/rfc9700#name-refresh-token-protection

### Quelles mesures relèvent du durcissement d'une API NestJS en production ? (plusieurs réponses)
- [x] `helmet()` pour les en-têtes de sécurité
- [x] Une liste blanche d'origines CORS
- [x] Valider les variables d'environnement au démarrage
- [ ] Renvoyer la stack trace des erreurs 500 au client
> Exposer les stack traces aide les attaquants (chemins, versions, requêtes). Les erreurs détaillées vont dans les logs, pas dans la réponse.
[doc]: NestJS — Helmet (EN) | https://docs.nestjs.com/security/helmet
