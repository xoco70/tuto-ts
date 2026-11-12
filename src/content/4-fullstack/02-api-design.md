---
id: fs-api
track: fullstack
order: 2
title: Conception d'API - REST, GraphQL, tRPC, contrats
level: Senior
summary: Méthodes HTTP et idempotence, codes de statut, pagination, versioning, cache HTTP, idempotency keys, webhooks, REST vs GraphQL vs tRPC, contrats typés.
---

## Méthodes HTTP

| Méthode | Usage | Sûre | Idempotente |
| --- | --- | --- | --- |
| `GET` | lire | ✅ | ✅ |
| `POST` | créer / action | ❌ | ❌ |
| `PUT` | remplacer entièrement | ❌ | ✅ |
| `PATCH` | modifier partiellement | ❌ | ❌ (pas garanti) |
| `DELETE` | supprimer | ❌ | ✅ |

**Idempotent** : répéter la requête produit le même **état** final (pas forcément la même réponse : un second `DELETE` peut renvoyer 404).

## Codes de statut

- `200 OK`, `201 Created` (+ en-tête `Location`), `202 Accepted` (traitement asynchrone), `204 No Content`.
- `400` (requête invalide), `401` (non authentifié), `403` (interdit), `404`, `409 Conflict` (conflit d'état, doublon), `412 Precondition Failed`, `422 Unprocessable Content` (validation métier), `429 Too Many Requests`.
- `500` (bug), `502`/`503`/`504` (dépendance ou surcharge).

Format d'erreur cohérent : **RFC 9457 Problem Details** (`application/problem+json` : `type`, `title`, `status`, `detail`, `instance`).

## Ressources et URL

```http
GET    /orders?status=paid&limit=20&cursor=abc
GET    /orders/42
POST   /orders
PATCH  /orders/42
POST   /orders/42/cancel        # action métier explicite
GET    /users/7/orders          # sous-ressource
```

Noms au pluriel, pas de verbes pour le CRUD, actions métier en sous-ressource quand elles ne sont pas un simple changement de champ.

## Pagination, filtres, tri

Curseur pour les flux volumineux (`?cursor=…&limit=20` → `{ data, nextCursor }`), offset pour les back-offices avec numéros de page. Toujours **plafonner** `limit`.

## Versioning et évolution

- Ajouter un champ optionnel = **compatible**. Supprimer/renommer un champ, rendre un champ obligatoire, changer un type = **cassant**.
- Versionner (`/v2`, en-tête) seulement pour les changements cassants, avec une période de dépréciation (en-têtes `Deprecation`, `Sunset`).
- Le client doit **ignorer** les champs inconnus (*tolerant reader*).

## Cache HTTP

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: "v42"
# requête suivante
If-None-Match: "v42"   →   304 Not Modified (sans body)
```

`Cache-Control: private` pour les réponses personnalisées (jamais en cache partagé/CDN), `no-store` pour les données sensibles. `ETag` + `If-Match` permet aussi le verrouillage optimiste (`412` si la ressource a changé).

## Idempotency keys

Un client réessaie un `POST /payments` après un timeout : sans protection, double paiement.

```http
POST /payments
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

Le serveur stocke la clé avec le résultat ; une requête répétée avec la même clé renvoie le **même résultat** sans ré-exécuter. Pratique de Stripe et standard en cours à l'IETF.

## Webhooks

- Signer chaque envoi (HMAC du body + timestamp) ; le récepteur vérifie la signature et rejette les vieux timestamps (rejeu).
- Le récepteur répond **vite** (2xx) puis traite en asynchrone, et dédoublonne par id d'événement (livraison *at-least-once*).
- Retries avec backoff côté émetteur.

## REST vs GraphQL vs tRPC

| | REST | GraphQL | tRPC |
| --- | --- | --- | --- |
| Contrat | OpenAPI | schéma GraphQL | types TS inférés |
| Clients | tous | tous | **TypeScript** uniquement |
| Over/under-fetching | possible | le client choisit ses champs | comme REST |
| Cache HTTP | natif | difficile (POST unique) | partiel |
| Points d'attention | multiplication des endpoints | N+1, coût des requêtes, autorisation par champ | couplage fort front/back |

tRPC convient à un monorepo TS où front et back évoluent ensemble ; REST + OpenAPI pour des API publiques ou multi-clients ; GraphQL pour des clients variés aux besoins de données hétérogènes.

## Contrats typés de bout en bout

Options : générer les types depuis OpenAPI (`openapi-typescript`, Orval), partager des schémas Zod (`ts-rest`, `zod-openapi`), ou tRPC. Objectif : **un changement de contrat casse la compilation**, pas la production.

<!-- QUIZ -->

### Quelles méthodes HTTP sont idempotentes ? (plusieurs réponses)
- [x] `PUT`
- [x] `DELETE`
- [ ] `POST`
- [x] `GET`
> Répéter un `PUT` ou un `DELETE` laisse le même état final. `POST` crée typiquement une nouvelle ressource à chaque appel. `PATCH` n'est pas idempotent par définition (ex. `{ "op": "increment" }`).
[doc]: MDN — Idempotent | https://developer.mozilla.org/fr/docs/Glossary/Idempotent

### Quel code de statut renvoyer après la création réussie d'une ressource via `POST /orders` ?
- [ ] 200 OK
- [x] 201 Created, idéalement avec un en-tête `Location: /orders/42`
- [ ] 204 No Content
- [ ] 202 Accepted
> 202 signifie « accepté, traitement asynchrone en cours » (job en file). 204 est utilisé quand il n'y a pas de body (souvent pour `DELETE`).
[doc]: MDN — 201 Created | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Status/201

### Un client crée un compte avec un email déjà utilisé. Quel statut est le plus approprié ?
- [ ] 400 Bad Request
- [ ] 500 Internal Server Error
- [x] 409 Conflict
- [ ] 404 Not Found
> La requête est bien formée, mais entre en conflit avec l'état actuel de la ressource. Attention : sur une inscription publique, cela permet d'énumérer les emails — certains produits préfèrent une réponse neutre.
[doc]: MDN — 409 Conflict | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Status/409

### Comment éviter un double paiement quand un client réessaie un `POST /payments` après un timeout réseau ?
- [ ] Interdire les retries côté client
- [x] Exiger un en-tête `Idempotency-Key` : le serveur mémorise la clé et renvoie le même résultat pour toute requête répétée avec cette clé
- [ ] Utiliser `PUT` à la place
- [ ] Ajouter un délai de 10 secondes
> Le client ne sait pas si la première requête a abouti. La clé d'idempotence rend le `POST` sûr à rejouer. Stripe l'applique sur toutes ses requêtes de création.
[doc]: Stripe — Idempotent requests (EN) | https://docs.stripe.com/api/idempotent_requests

### Parmi ces changements d'une API, lequel est cassant pour les clients existants ?
- [ ] Ajouter un champ optionnel dans la réponse
- [ ] Ajouter un nouvel endpoint
- [x] Renommer le champ `total` en `amount` dans la réponse
- [ ] Ajouter une valeur par défaut à un paramètre optionnel
> Supprimer, renommer, changer le type d'un champ ou rendre un paramètre obligatoire casse les clients. Stratégie : ajouter le nouveau champ, déprécier l'ancien, puis le retirer dans une nouvelle version.
[doc]: Google Cloud — API design guide, compatibility (EN) | https://cloud.google.com/apis/design/compatibility

### Que se passe-t-il quand un client envoie `If-None-Match: "v42"` et que la ressource n'a pas changé ?
- [ ] Le serveur renvoie 200 avec la ressource complète
- [x] Le serveur renvoie 304 Not Modified sans body : le client réutilise sa copie en cache
- [ ] Le serveur renvoie 412
- [ ] Le serveur renvoie 404
> L'`ETag` identifie une version de la ressource. La revalidation conditionnelle économise la bande passante. Avec `If-Match` sur une écriture, l'ETag sert au verrouillage optimiste.
[doc]: MDN — ETag | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/ETag

### Quelle directive `Cache-Control` utiliser pour une réponse contenant les données personnelles de l'utilisateur connecté ?
- [ ] `public, max-age=3600`
- [x] `private` (voire `no-store` pour des données sensibles)
- [ ] `immutable`
- [ ] Aucune directive
> `public` autoriserait un CDN ou un proxy à servir la réponse d'un utilisateur à un autre. `private` limite le cache au navigateur ; `no-store` interdit tout stockage.
[doc]: MDN — Cache-Control | https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers/Cache-Control

### Comment un récepteur de webhook doit-il se protéger ?
- [ ] En acceptant toutes les requêtes venant d'Internet
- [x] En vérifiant la signature HMAC et le timestamp, en répondant 2xx rapidement puis en traitant en asynchrone, et en dédoublonnant par id d'événement
- [ ] En traitant tout de façon synchrone avant de répondre
- [ ] En exigeant un mot de passe dans l'URL
> Sans vérification, n'importe qui peut forger un événement « paiement réussi ». La livraison étant *at-least-once*, le même événement peut arriver plusieurs fois : le traitement doit être idempotent.
[doc]: Stripe — Webhooks, vérifier les signatures (EN) | https://docs.stripe.com/webhooks#verify-events

### Quel est un inconvénient classique de GraphQL par rapport à REST ?
- [ ] Il ne supporte pas TypeScript
- [x] Le cache HTTP est plus difficile (requêtes POST sur un endpoint unique) et il faut maîtriser le N+1 et le coût des requêtes complexes
- [ ] Il impose de sur-récupérer des données
- [ ] Il ne permet pas les mutations
> GraphQL laisse le client choisir les champs, mais déplace la complexité côté serveur : DataLoader, limites de profondeur/complexité, autorisation par champ, cache applicatif.
[doc]: GraphQL — Best practices, caching (EN) | https://graphql.org/learn/caching/

### Dans quel contexte tRPC est-il particulièrement adapté ?
- [ ] Une API publique consommée par des clients Java, Python et Go
- [x] Un monorepo TypeScript où le front et le back sont développés et déployés ensemble
- [ ] Une API qui doit être cachée par un CDN
- [ ] Un système de messages asynchrones
> tRPC infère les types directement depuis les procédures du serveur, sans génération de code. Le prix : couplage fort et clients non-TS mal servis.
[doc]: tRPC — Introduction (EN) | https://trpc.io/docs

### Quel format standard permet de décrire des erreurs d'API HTTP de façon cohérente ?
- [ ] JSON:API uniquement
- [x] Problem Details (RFC 9457, `application/problem+json`)
- [ ] SOAP Fault
- [ ] Un texte brut
> Champs `type`, `title`, `status`, `detail`, `instance`, extensibles (ex. `errors` de validation). Un format unique simplifie la gestion d'erreurs côté client.
[doc]: RFC 9457 — Problem Details for HTTP APIs (EN) | https://www.rfc-editor.org/rfc/rfc9457.html

### Comment modéliser l'annulation d'une commande en REST ?
- [ ] `GET /cancelOrder?id=42`
- [x] `POST /orders/42/cancel` (action métier) ou `PATCH /orders/42` avec `{ "status": "cancelled" }` selon la richesse de la règle
- [ ] `DELETE /orders` avec l'id dans le body
- [ ] `PUT /cancel`
> Un `GET` ne doit jamais modifier l'état (les prefetchers et crawlers le déclenchent). Une action métier avec des règles (remboursement, notification) gagne à avoir son endpoint explicite.
[doc]: MDN — Méthodes HTTP sûres | https://developer.mozilla.org/fr/docs/Glossary/Safe/HTTP

### Quelles approches donnent un typage de bout en bout entre un backend NestJS et un front React ? (plusieurs réponses)
- [x] Générer les types du client depuis le document OpenAPI produit par `@nestjs/swagger`
- [x] Partager des schémas Zod dans un package commun d'un monorepo
- [ ] Recopier à la main les interfaces dans le front
- [x] Utiliser tRPC (avec un adaptateur dans l'application Node)
> La copie manuelle diverge inévitablement. Les trois autres approches font échouer la compilation du front quand le contrat change.
[doc]: openapi-typescript (EN) | https://openapi-ts.dev/
