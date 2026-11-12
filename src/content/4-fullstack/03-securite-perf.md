---
id: fs-securite-perf
track: fullstack
order: 3
title: Sécurité web et performance à l'échelle
level: Senior
summary: OWASP Top 10, XSS / CSRF / SQLi / SSRF, cookies et CSP, stratégies de cache, index de base de données, scalabilité horizontale.
---

## OWASP Top 10 : les incontournables

| Faille | Exemple | Défense |
| --- | --- | --- |
| **Contrôle d'accès défaillant** (IDOR/BOLA) | `GET /invoices/123` d'un autre client | vérifier la propriété côté serveur, à chaque requête |
| **Injection** (SQL, NoSQL, commande) | `` `SELECT * FROM users WHERE email = '${email}'` `` | requêtes paramétrées / ORM, jamais de concaténation |
| **XSS** | commentaire contenant `<script>` | échappement (React le fait), CSP, sanitisation (DOMPurify) si HTML |
| **CSRF** | un site tiers déclenche un `POST` avec les cookies de la victime | `SameSite`, token CSRF, vérifier `Origin` |
| **SSRF** | `POST /preview { url: "http://169.254.169.254/" }` | liste blanche de domaines, bloquer les IP internes |
| **Mauvaise configuration** | stack traces, CORS `*`, debug activé | durcissement, revue de config |
| **Composants vulnérables** | dépendance npm avec CVE | `npm audit`, Dependabot/Renovate, lockfile |
| **Échecs cryptographiques** | mots de passe en SHA-1, HTTP | argon2/bcrypt, TLS partout, HSTS |

### Requêtes paramétrées

```ts
// ❌ injection
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
// ✅ paramétrée (tagged template)
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

### Cookies de session

```http
Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

- `HttpOnly` : illisible en JavaScript (protège du vol par XSS).
- `Secure` : envoyé uniquement en HTTPS.
- `SameSite=Lax` : pas envoyé sur les requêtes cross-site non « top-level » (protège l'essentiel du CSRF) ; `Strict` encore plus restrictif ; `None` exige `Secure`.

### Content Security Policy

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-r4nd0m'; object-src 'none'; frame-ancestors 'none'
```

Seconde ligne de défense contre le XSS : même si un script est injecté, le navigateur refuse de l'exécuter s'il ne correspond pas à la politique.

### Chaîne d'approvisionnement

Lockfile versionné, `npm ci` en CI, audit des dépendances, méfiance envers les scripts `postinstall`, épinglage des versions d'actions GitHub, principe du moindre privilège pour les tokens de CI.

## Performance : mesurer d'abord

Profiler avant d'optimiser : APM (traces), `EXPLAIN ANALYZE`, métriques p50/p95/p99 (la **moyenne cache les pires cas**).

### Index de base de données

```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
-- sert : WHERE user_id = ? ORDER BY created_at DESC
-- ne sert pas efficacement : WHERE created_at > ? seul (colonne non préfixe)
```

- Un index composite est utilisé de gauche à droite (**préfixe**).
- Chaque index **ralentit les écritures** et occupe de l'espace.
- `EXPLAIN` révèle les *sequential scans* sur grosses tables.
- Les fonctions sur colonne (`WHERE LOWER(email) = ?`) empêchent l'index classique → index fonctionnel ou colonne normalisée.

### Stratégies de cache

| Stratégie | Principe |
| --- | --- |
| **Cache-aside** | l'app lit le cache ; si absent, lit la base et remplit le cache (TTL) |
| Write-through | l'écriture passe par le cache puis la base |
| CDN / cache HTTP | réponses publiques au plus près de l'utilisateur |
| Mémoïsation en process | rapide, mais non partagée entre instances |

« Il n'y a que deux choses difficiles en informatique : l'invalidation de cache et nommer les choses. » Prévoir TTL, invalidation à l'écriture, et la protection contre le **cache stampede** (verrou, *stale-while-revalidate*, TTL avec jitter).

### Scalabilité horizontale

Pour ajouter des instances derrière un load balancer, l'application doit être **stateless** : sessions en Redis/DB (ou JWT), fichiers sur un stockage objet (S3), tâches planifiées avec verrou distribué, WebSockets avec adapter Redis.

Goulots fréquents : base de données (pool de connexions, index, réplicas en lecture), appels synchrones en chaîne, absence de timeouts. Toujours fixer des **timeouts** et des **circuit breakers** sur les appels sortants.

### Côté front

Bundle (code splitting, tree-shaking), images (formats modernes, dimensions, lazy loading), polices, cache des assets avec hash dans le nom (`Cache-Control: immutable`), rendu serveur pour le premier affichage.

## Pour aller plus loin

- [Node.js Best Practices, section Sécurité](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md#6-bonnes-pratiques-de-sécurité) : 25 pratiques concrètes pour Node, dont la limitation de débit, l'injection, les en-têtes HTTP, l'audit des dépendances et l'exécution sans root (traduction française de 2023).
- [System Design Primer](https://github.com/donnemartin/system-design-primer) (en anglais) : [load balancers](https://github.com/donnemartin/system-design-primer#load-balancer), [patterns de disponibilité](https://github.com/donnemartin/system-design-primer#availability-patterns), [bases de données](https://github.com/donnemartin/system-design-primer#database) (réplication, fédération, sharding) et [traitements asynchrones](https://github.com/donnemartin/system-design-primer#asynchronism) pour la montée en charge.

<!-- QUIZ -->

### Quelle requête est vulnérable à l'injection SQL ?
- [ ] ``prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}` ``
- [x] ``prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`)``
- [ ] `prisma.user.findUnique({ where: { id } })`
- [ ] `repo.findOneBy({ id })`
> Le tagged template `$queryRaw` transforme les interpolations en paramètres. `$queryRawUnsafe` avec une template string ordinaire concatène la valeur dans le SQL. Même règle avec le QueryBuilder TypeORM : utiliser `:param`.
[doc]: OWASP — SQL Injection Prevention Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

### Que protège l'attribut de cookie `HttpOnly` ?
- [ ] Il chiffre le cookie
- [x] Il empêche JavaScript de lire le cookie, ce qui limite le vol de session en cas de XSS
- [ ] Il empêche l'envoi du cookie en HTTP
- [ ] Il bloque le CSRF
> `Secure` impose HTTPS ; `SameSite` limite l'envoi cross-site (CSRF). Les trois sont complémentaires pour un cookie de session.
[doc]: MDN — Cookies, sécurité | https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/Cookies#sécurité

### Qu'est-ce qu'une attaque CSRF ?
- [ ] Injecter un script dans une page
- [x] Faire exécuter par le navigateur de la victime une requête authentifiée (avec ses cookies) vers un site où elle est connectée, depuis un site tiers
- [ ] Voler un mot de passe par hameçonnage
- [ ] Saturer un serveur de requêtes
> La protection repose sur `SameSite`, un token CSRF, et la vérification des en-têtes `Origin`/`Referer`. Une API authentifiée uniquement par en-tête `Authorization` (pas par cookie) n'est pas exposée au CSRF classique.
[doc]: MDN — CSRF | https://developer.mozilla.org/fr/docs/Glossary/CSRF

### Un endpoint génère l'aperçu d'une URL fournie par l'utilisateur. Quelle faille faut-il anticiper ?
- [ ] XSS
- [x] SSRF : l'attaquant peut faire appeler par le serveur des adresses internes (métadonnées cloud, services privés)
- [ ] CSRF
- [ ] Clickjacking
> Défense : liste blanche de domaines ou de schémas, résolution DNS puis blocage des plages privées (10.x, 169.254.x, localhost), pas de redirections suivies aveuglément, réseau de sortie restreint.
[doc]: OWASP — SSRF Prevention Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

### Quel est le rôle d'une Content Security Policy ?
- [ ] Chiffrer le contenu de la page
- [x] Indiquer au navigateur quelles sources de scripts, styles, images… sont autorisées, ce qui limite l'impact d'un XSS
- [ ] Remplacer CORS
- [ ] Bloquer les robots
> Une CSP stricte (nonces ou hashes, pas de `unsafe-inline`) empêche l'exécution de scripts injectés. `frame-ancestors` protège aussi du clickjacking.
[doc]: MDN — Content Security Policy | https://developer.mozilla.org/fr/docs/Web/HTTP/Guides/CSP

### Avec un index sur `(user_id, created_at)`, laquelle de ces requêtes en profite le moins ?
- [ ] `WHERE user_id = 7`
- [ ] `WHERE user_id = 7 ORDER BY created_at DESC`
- [x] `WHERE created_at > '2026-01-01'`
- [ ] `WHERE user_id = 7 AND created_at > '2026-01-01'`
> Un index composite s'utilise par son **préfixe** gauche. Filtrer uniquement sur la deuxième colonne ne permet pas une recherche efficace dans l'index.
[doc]: Use The Index, Luke — Concatenated indexes (EN) | https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys

### Pourquoi suivre la latence p95/p99 plutôt que la moyenne ?
- [ ] La moyenne est plus difficile à calculer
- [x] La moyenne masque les requêtes lentes qui touchent une part significative des utilisateurs ; les percentiles hauts révèlent ces cas
- [ ] Les percentiles sont toujours plus faibles
- [ ] C'est une obligation légale
> Avec 100 appels par page, presque chaque utilisateur subit la latence p99. Les SLO s'expriment généralement en percentiles.
[doc]: Google SRE Book — Service Level Objectives (EN) | https://sre.google/sre-book/service-level-objectives/

### Comment fonctionne le pattern cache-aside ?
- [ ] La base de données remplit le cache automatiquement
- [x] L'application cherche dans le cache ; en cas d'absence, elle lit la base, stocke le résultat dans le cache avec un TTL, puis répond
- [ ] Toutes les écritures passent par le cache
- [ ] Le cache est vidé à chaque requête
> C'est le pattern le plus courant avec Redis. À compléter par une invalidation lors des écritures et une protection contre le *cache stampede*.
[doc]: Microsoft — Cache-Aside pattern (FR) | https://learn.microsoft.com/fr-fr/azure/architecture/patterns/cache-aside

### Qu'est-ce qu'un « cache stampede » ?
- [ ] Un cache trop gros
- [x] Une clé populaire expire et des centaines de requêtes simultanées recalculent la valeur en même temps, surchargeant la base
- [ ] Une fuite mémoire dans Redis
- [ ] Un cache partagé entre utilisateurs
> Parades : verrou (une seule requête recalcule), *stale-while-revalidate* (servir l'ancienne valeur pendant le recalcul), expiration probabiliste ou TTL avec jitter.
[doc]: Wikipedia — Cache stampede (EN) | https://en.wikipedia.org/wiki/Cache_stampede

### Que faut-il pour qu'une API NestJS puisse tourner sur plusieurs instances derrière un load balancer ?
- [ ] Rien de particulier
- [x] Qu'elle soit stateless : sessions et cache partagés (Redis/DB), fichiers sur stockage objet, crons avec verrou, WebSockets avec adapter
- [ ] Qu'elle utilise le scope REQUEST
- [ ] Qu'elle tourne en mode cluster de Node uniquement
> Tout état gardé en mémoire d'une instance (session, upload local, rate limit en mémoire) devient incohérent dès qu'il y a deux instances.
[doc]: The Twelve-Factor App — Processus (FR) | https://12factor.net/fr/processes

### Pourquoi définir un timeout sur chaque appel HTTP sortant ?
- [ ] Pour accélérer les appels
- [x] Sans timeout, un service tiers lent garde des connexions et des requêtes en attente indéfiniment, ce qui peut épuiser les ressources et provoquer une panne en cascade
- [ ] C'est requis par HTTPS
- [ ] Pour réduire la taille des réponses
> Timeout + retries limités avec backoff + circuit breaker = résilience. Node `fetch` n'a pas de timeout par défaut : utiliser `AbortSignal.timeout()`.
[doc]: Microsoft — Circuit Breaker pattern (FR) | https://learn.microsoft.com/fr-fr/azure/architecture/patterns/circuit-breaker

### Pourquoi `WHERE LOWER(email) = ?` peut-il être lent malgré un index sur `email` ?
- [ ] `LOWER` est interdit en SQL
- [x] Appliquer une fonction à la colonne empêche l'utilisation de l'index classique : il faut un index fonctionnel ou stocker l'email normalisé
- [ ] Les index ne fonctionnent pas sur les chaînes
- [ ] Il faut `LIKE` à la place
> L'index est trié sur `email`, pas sur `LOWER(email)`. PostgreSQL : `CREATE INDEX ON users (LOWER(email))` ou type `citext`.
[doc]: Use The Index, Luke — Functions (EN) | https://use-the-index-luke.com/sql/where-clause/functions

### Quelles mesures réduisent le risque d'attaque par la chaîne d'approvisionnement npm ? (plusieurs réponses)
- [x] Versionner le lockfile et utiliser `npm ci` en CI
- [x] Surveiller les dépendances (Dependabot / Renovate, `npm audit`)
- [ ] Mettre à jour toutes les dépendances vers `latest` automatiquement sans revue
- [x] Limiter les droits des tokens de CI et épingler les actions GitHub
> Les mises à jour aveugles sont précisément le vecteur des paquets compromis. Revue, délai de quarantaine sur les nouvelles versions et moindre privilège limitent l'exposition.
[doc]: OWASP — NPM Security Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html

### React échappe le texte affiché. Quel code reste pourtant vulnérable au XSS ?
- [ ] `<p>{commentaire}</p>`
- [x] `<a href={user.siteWeb}>Site</a>` avec une valeur fournie par l'utilisateur
- [ ] `<input value={recherche} />`
- [ ] `<p title={commentaire}>…</p>`
> Une URL `javascript:alert(1)` dans un `href` s'exécute au clic. Il faut valider le schéma (`https:` uniquement) côté serveur et côté client. Autres vecteurs : `dangerouslySetInnerHTML` sans assainissement (DOMPurify), et l'injection dans du HTML généré côté serveur.
[doc]: OWASP — XSS Prevention Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

### Une clé d'API de production a été poussée par erreur dans un dépôt Git. Quelle est l'action prioritaire ?
- [ ] Supprimer le fichier dans un nouveau commit
- [x] Révoquer et remplacer la clé immédiatement, puis nettoyer l'historique et chercher des usages suspects
- [ ] Rendre le dépôt privé
- [ ] Réécrire l'historique avec `git filter-repo`, cela suffit
> Une fois poussé, un secret doit être considéré comme **compromis** : il peut avoir été cloné, mis en cache ou indexé par des robots en quelques minutes. Prévention : secrets dans un gestionnaire dédié, `.env` dans `.gitignore`, détection de secrets en pre-commit et en CI.
[doc]: OWASP — Secrets Management Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

### Comment fonctionne un rate limiter en « seau à jetons » (*token bucket*) ?
- [ ] Il refuse toute requête au-delà de N par minute calendaire
- [x] Le seau se remplit à débit constant jusqu'à une capacité maximale ; chaque requête consomme un jeton, et sans jeton elle est refusée
- [ ] Il met les requêtes en file d'attente indéfiniment
- [ ] Il bloque l'IP pendant une heure au premier dépassement
> Ce modèle autorise de courtes **rafales** (jusqu'à la capacité) tout en bornant le débit moyen. La fenêtre fixe, plus simple, laisse passer le double de requêtes à la jonction de deux fenêtres.
[doc]: Wikipédia — Seau à jetons | https://fr.wikipedia.org/wiki/Seau_%C3%A0_jetons

### À quoi sert l'en-tête `Strict-Transport-Security` ?
- [ ] À chiffrer le corps des réponses
- [x] À obliger le navigateur à n'utiliser que HTTPS pour ce domaine pendant une durée donnée
- [ ] À bloquer les requêtes cross-origin
- [ ] À signer les cookies
> HSTS empêche une première requête en HTTP clair interceptable (attaque de *downgrade* sur un Wi-Fi public). `includeSubDomains` étend la règle aux sous-domaines ; à activer seulement quand tout est servi en HTTPS.
[doc]: MDN — Strict-Transport-Security | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security

### Comment savoir pourquoi une requête SQL est lente ?
- [ ] Ajouter des index sur toutes les colonnes
- [x] Lancer `EXPLAIN ANALYZE` pour voir le plan réel : parcours séquentiels, estimations erronées, tris coûteux
- [ ] Augmenter la RAM du serveur
- [ ] Passer à une base NoSQL
> Le plan montre si un index est utilisé (`Index Scan`) ou non (`Seq Scan`), et l'écart entre lignes estimées et réelles. Attention : `ANALYZE` exécute vraiment la requête, à envelopper dans une transaction annulée pour un `UPDATE` ou un `DELETE`.
[doc]: PostgreSQL — Using EXPLAIN (EN) | https://www.postgresql.org/docs/current/using-explain.html

### Comment mettre en cache les fichiers JS/CSS d'un build Vite (noms du type `index-a1b2c3.js`) ?
- [ ] `Cache-Control: no-store`
- [x] `Cache-Control: public, max-age=31536000, immutable`, et `no-cache` pour `index.html`
- [ ] Ne rien envoyer, le navigateur décide
- [ ] Le même `max-age` court pour tous les fichiers
> Le hash dans le nom change à chaque modification du contenu : ces fichiers peuvent être gardés « pour toujours ». Seul `index.html`, qui les référence, doit être revalidé à chaque visite pour que les utilisateurs récupèrent la nouvelle version.
[doc]: MDN — Cache-Control | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Cache-Control

### Comment empêcher qu'un site malveillant affiche votre application dans une `<iframe>` invisible pour piéger les clics (*clickjacking*) ?
- [ ] Avec `HttpOnly` sur les cookies
- [x] Avec la directive CSP `frame-ancestors 'none'` (ou `'self'`), ou l'ancien en-tête `X-Frame-Options: DENY`
- [ ] Avec CORS
- [ ] Avec un captcha
> CORS ne contrôle pas l'intégration en iframe. `frame-ancestors` précise quelles origines peuvent encadrer la page ; `helmet` pose ces en-têtes par défaut.
[doc]: MDN — CSP frame-ancestors | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors

### Avec quels droits l'application doit-elle se connecter à la base de données en production ?
- [ ] Ceux du superutilisateur `postgres`, pour éviter les erreurs
- [x] Un rôle dédié limité aux opérations nécessaires (lecture/écriture sur ses tables), distinct du rôle qui exécute les migrations
- [ ] Un rôle en lecture seule
- [ ] Peu importe, la base n'est pas exposée sur Internet
> Principe du **moindre privilège** : si l'application est compromise (injection SQL, RCE), l'attaquant ne peut pas supprimer des schémas, lire d'autres bases ou créer des utilisateurs.
[doc]: OWASP — Database Security Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html

### Pourquoi utiliser `npm ci` plutôt que `npm install` en CI et dans un Dockerfile ?
- [ ] `npm ci` est plus récent
- [x] `npm ci` installe exactement ce que décrit `package-lock.json`, échoue s'il n'est pas synchronisé, et part d'un `node_modules` vide
- [ ] `npm ci` n'installe pas les dépendances de développement
- [ ] `npm ci` met à jour les dépendances vers leur dernière version
> Les builds deviennent reproductibles : pas de résolution de nouvelle version mineure entre deux builds, et un lockfile désynchronisé est détecté au lieu d'être silencieusement réécrit.
[doc]: npm — npm ci (EN) | https://docs.npmjs.com/cli/commands/npm-ci

### Une API reçoit 200 requêtes par seconde et chaque requête dure en moyenne 50 ms. Combien de requêtes sont en cours simultanément, en moyenne ?
- [ ] 4
- [x] 10
- [ ] 50
- [ ] 200
> **Loi de Little** : concurrence = débit × temps de séjour = 200 × 0,05 = 10. Si la latence passe à 500 ms (base lente), on monte à 100 requêtes en cours — de quoi épuiser un pool de connexions de 20. Utile en entretien de system design.
[doc]: Wikipédia — Loi de Little | https://fr.wikipedia.org/wiki/Loi_de_Little

### Comment accélérer ce code quand `commandes` et `clientsVip` contiennent chacun 50 000 éléments ?
```ts
const vip = commandes.filter((c) => clientsVip.includes(c.clientId));
```
- [ ] Remplacer `filter` par une boucle `for`
- [x] Construire un `Set` : `const ids = new Set(clientsVip)` puis `ids.has(c.clientId)`
- [ ] Trier les deux tableaux
- [ ] Utiliser `Promise.all`
> `includes` parcourt le tableau à chaque appel : O(n × m), soit 2,5 milliards de comparaisons. `Set.has` est en temps quasi constant : O(n + m). C'est le genre de goulot qui apparaît quand un jeu de données grossit.
[doc]: MDN — Set | https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Set
