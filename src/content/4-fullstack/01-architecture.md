---
id: fs-architecture
track: fullstack
order: 1
title: Architecture logicielle et conception
level: Senior
summary: SOLID, architecture hexagonale / clean, DDD tactique et stratégique, monolithe modulaire vs microservices, patterns utiles.
---

## SOLID, appliqué à TypeScript

- **S** — *Single Responsibility* : une classe a une seule raison de changer. `OrdersService` qui calcule les prix, envoie les emails et génère les PDF en a trois.
- **O** — *Open/Closed* : ouvert à l'extension, fermé à la modification. Ajouter un moyen de paiement = ajouter une classe `PaymentProvider`, pas un `case` de plus.
- **L** — *Liskov* : une sous-classe doit pouvoir remplacer sa classe parente sans casser le comportement attendu.
- **I** — *Interface Segregation* : plusieurs petites interfaces plutôt qu'une grosse (`Readable`, `Writable`).
- **D** — *Dependency Inversion* : le métier dépend d'**abstractions**, pas d'implémentations. C'est ce que rend naturel l'injection de dépendances de NestJS.

## Architecture hexagonale (ports & adapters) / Clean Architecture

```
            ┌──────────── Adapters entrants ────────────┐
            │  Controller HTTP · Consumer de queue · CLI │
            └────────────────────┬──────────────────────┘
                                 ▼
                ┌────────── Application ──────────┐
                │   Cas d'usage (PlaceOrder…)       │
                │   ↓ dépend de ports (interfaces)  │
                ├──────────── Domaine ─────────────┤
                │ Entités, Value Objects, règles    │
                └──────────────────┬───────────────┘
                                   ▼ implémentés par
            ┌──────────── Adapters sortants ────────────┐
            │  Repository Prisma · Client Stripe · SMTP  │
            └───────────────────────────────────────────┘
```

Règle de dépendance : **les dépendances pointent vers le domaine**. Le domaine n'importe ni NestJS, ni Prisma, ni Express. Bénéfices : métier testable sans infrastructure, infrastructure remplaçable. Coût : plus de fichiers et d'indirection — à proportionner à la complexité du métier.

En NestJS : le port est une classe abstraite (token), l'adapter est fourni par `{ provide: OrderRepository, useClass: PrismaOrderRepository }`.

## DDD (Domain-Driven Design)

### Tactique

- **Entité** : identité stable dans le temps (`Order#42`), même si ses attributs changent.
- **Value Object** : défini par ses valeurs, **immuable**, comparé par égalité de valeurs (`Money(10, 'EUR')`, `Email`). Il porte sa validation.
- **Agrégat** : grappe d'objets cohérente avec une **racine** ; on ne modifie l'intérieur que via la racine, et une transaction = un agrégat.
- **Événement de domaine** : `OrderPlaced`, un fait passé.
- **Repository** : charge/sauve des agrégats entiers.

### Stratégique

- **Bounded context** : frontière dans laquelle un modèle et un vocabulaire sont cohérents (« Client » ne veut pas dire la même chose en facturation et en support).
- **Langage omniprésent** (*ubiquitous language*) : le code utilise les mots du métier.
- **Context map** : relations entre contextes (anti-corruption layer pour isoler un système legacy).

## Monolithe modulaire vs microservices

| | Monolithe modulaire | Microservices |
| --- | --- | --- |
| Déploiement | un artefact | indépendant par service |
| Transactions | ACID locales | distribuées → sagas, cohérence à terme |
| Complexité opérationnelle | faible | élevée (réseau, observabilité, versions) |
| Scalabilité | globale | ciblée par service |
| Organisation | une équipe ou quelques-unes | équipes autonomes par service |

Position senior habituelle : **commencer par un monolithe modulaire** aux frontières claires (modules Nest = bounded contexts, pas d'accès direct aux tables d'un autre module), et extraire un service quand un besoin réel l'impose (scalabilité, équipe, cycle de déploiement). Un *distributed monolith* (microservices couplés) cumule les inconvénients des deux.

## Patterns qui reviennent

- **Strategy** : choisir un algorithme à l'exécution (moyens de paiement).
- **Adapter** : envelopper une API tierce derrière notre interface.
- **Factory** : centraliser une création complexe.
- **Observer / Pub-Sub** : événements.
- **Outbox** : publier des événements de façon fiable avec la transaction.
- **Saga** : enchaîner des transactions locales avec des actions de compensation.
- **CQRS** : modèles séparés pour l'écriture et la lecture.

## Dette technique et décisions

Documenter les choix structurants dans des **ADR** (*Architecture Decision Records*) : contexte, décision, alternatives, conséquences. Un senior sait expliquer un **compromis** (*trade-off*), pas seulement une « bonne pratique ».

<!-- QUIZ -->

### Quel principe SOLID est respecté quand on ajoute un moyen de paiement en créant une nouvelle classe sans modifier le code existant ?
- [ ] Single Responsibility
- [x] Open/Closed
- [ ] Liskov Substitution
- [ ] Interface Segregation
> Le code est ouvert à l'extension (nouvelle implémentation de `PaymentProvider`) et fermé à la modification (pas de `switch` à étendre). Typiquement réalisé avec le pattern Strategy et l'injection.
[doc]: Wikipédia — Principe ouvert/fermé | https://fr.wikipedia.org/wiki/Principe_ouvert/ferm%C3%A9

### Que dit le principe d'inversion des dépendances ?
- [ ] Les classes de bas niveau doivent instancier les classes de haut niveau
- [x] Les modules de haut niveau (métier) ne dépendent pas des modules de bas niveau (infrastructure) : les deux dépendent d'abstractions
- [ ] Il faut toujours utiliser un conteneur IoC
- [ ] Les dépendances doivent être circulaires
> L'injection de dépendances est un moyen ; l'inversion est le principe. Le service métier dépend d'un `OrderRepository` abstrait, l'implémentation Prisma est un détail branché à l'extérieur.
[doc]: Wikipédia — Inversion des dépendances | https://fr.wikipedia.org/wiki/Inversion_des_d%C3%A9pendances

### Dans une architecture hexagonale, que contient la couche domaine ?
- [ ] Les controllers et les DTO HTTP
- [x] Les entités, value objects et règles métier, sans dépendance vers le framework ni la base de données
- [ ] Les migrations SQL
- [ ] La configuration NestJS
> Le domaine est le cœur stable. Les adapters (HTTP, Prisma, Stripe) dépendent de lui, jamais l'inverse : on peut tester le métier sans démarrer Nest ni une base.
[doc]: Alistair Cockburn — Hexagonal architecture (EN) | https://alistair.cockburn.us/hexagonal-architecture/

### Quelle est la différence entre une entité et un value object en DDD ?
- [ ] Une entité est stockée en base, un value object non
- [x] Une entité a une identité qui persiste malgré ses changements ; un value object est défini par ses valeurs, immuable, et deux value objects aux mêmes valeurs sont égaux
- [ ] Un value object a toujours un id
- [ ] Aucune
> `Order#42` reste la même commande si son statut change. `Money(10, 'EUR')` est interchangeable avec tout autre `Money(10, 'EUR')`. Les value objects portent leur validation (un `Email` est toujours valide).
[doc]: Martin Fowler — Value Object (EN) | https://martinfowler.com/bliki/ValueObject.html

### Qu'est-ce qu'un agrégat en DDD ?
- [ ] Une requête SQL avec `GROUP BY`
- [x] Un ensemble d'objets du domaine traité comme une unité de cohérence, accessible via une racine qui protège ses invariants
- [ ] Un microservice
- [ ] Un module NestJS
> Exemple : `Order` (racine) et ses `OrderLine`. On n'ajoute pas de ligne directement : `order.addLine()` vérifie les invariants (stock, plafond). Une transaction modifie idéalement un seul agrégat.
[doc]: Martin Fowler — DDD Aggregate (EN) | https://martinfowler.com/bliki/DDD_Aggregate.html

### Qu'est-ce qu'un bounded context ?
- [ ] Un scope d'injection NestJS
- [x] Une frontière explicite à l'intérieur de laquelle un modèle et son vocabulaire ont un sens précis et cohérent
- [ ] Un contexte React
- [ ] Une transaction de base de données
> Le « Produit » du catalogue (descriptions, photos) n'est pas celui de la logistique (poids, dimensions). Séparer les contextes évite un modèle unique tentaculaire. Ils guident aussi le découpage en modules ou services.
[doc]: Martin Fowler — Bounded Context (EN) | https://martinfowler.com/bliki/BoundedContext.html

### Une startup de 4 développeurs démarre un produit. Quelle architecture recommander en général ?
- [ ] 15 microservices dès le départ
- [x] Un monolithe modulaire aux frontières claires, avec la possibilité d'extraire un service plus tard si un besoin réel l'impose
- [ ] Une architecture serverless obligatoire
- [ ] Un seul fichier
> Les microservices résolvent surtout des problèmes d'organisation et de scalabilité ciblée, au prix d'une forte complexité (réseau, cohérence, observabilité). « Monolith first » est la recommandation la plus courante.
[doc]: Martin Fowler — MonolithFirst (EN) | https://martinfowler.com/bliki/MonolithFirst.html

### Comment garantir la cohérence d'une commande qui implique paiement, stock et livraison répartis dans trois services ?
- [ ] Une transaction distribuée en two-phase commit systématique
- [x] Une saga : une suite de transactions locales, chacune avec une action de compensation en cas d'échec d'une étape suivante
- [ ] Une base de données partagée par les trois services
- [ ] Ce n'est pas possible
> La saga (orchestrée ou chorégraphiée) accepte la **cohérence à terme**. Si la livraison échoue, on compense : remboursement, remise en stock. Le 2PC est rarement utilisé car bloquant et peu disponible.
[doc]: microservices.io — Saga (EN) | https://microservices.io/patterns/data/saga.html

### Qu'est-ce qu'un « distributed monolith » ?
- [ ] Un monolithe déployé sur plusieurs serveurs
- [x] Des microservices si couplés (appels synchrones en chaîne, base partagée, déploiements coordonnés) qu'ils cumulent les inconvénients d'un monolithe et du distribué
- [ ] Un monolithe modulaire
- [ ] Une architecture serverless
> Signes : impossible de déployer un service sans les autres, une panne en cascade, des changements qui touchent 5 services. Cause fréquente : découpage technique plutôt que par domaine.
[doc]: microservices.io — Microservice architecture (EN) | https://microservices.io/patterns/microservices.html

### Comment implémenter un « port » sortant de l'architecture hexagonale dans NestJS ?
- [ ] Avec une interface TypeScript injectée directement
- [x] Avec une classe abstraite (ou un token) définie dans le domaine, et l'adapter fourni via `{ provide: Port, useClass: Adapter }`
- [ ] Avec un middleware
- [ ] En important Prisma dans le domaine
> Une interface est effacée et ne peut pas servir de token. Une classe abstraite existe au runtime et documente le contrat. En test, on fournit un adapter en mémoire.
[doc]: NestJS — Custom providers (EN) | https://docs.nestjs.com/fundamentals/custom-providers

### À quoi sert un ADR (Architecture Decision Record) ?
- [ ] À générer la documentation de l'API
- [x] À tracer une décision d'architecture : contexte, décision, alternatives envisagées et conséquences
- [ ] À remplacer les tests
- [ ] À mesurer la dette technique automatiquement
> Six mois plus tard, l'ADR explique *pourquoi* on a choisi BullMQ plutôt que Kafka. Il évite de rejouer les débats et aide l'onboarding.
[doc]: ADR GitHub organization (EN) | https://adr.github.io/

### Quel pattern isole le code métier d'un système legacy dont le modèle est mauvais ?
- [ ] Singleton
- [x] Anti-corruption layer (couche anti-corruption) : une traduction entre le modèle legacy et notre modèle
- [ ] God object
- [ ] Active Record
> L'ACL traduit les concepts et formats du système externe, pour que ses incohérences ne contaminent pas notre domaine. Variante simple : un adapter avec mapping explicite.
[doc]: Microsoft — Anti-corruption Layer pattern (FR) | https://learn.microsoft.com/fr-fr/azure/architecture/patterns/anti-corruption-layer

### Quelles affirmations relèvent d'une posture d'architecte senior ? (plusieurs réponses)
- [x] Proportionner l'architecture à la complexité réelle du métier
- [x] Expliquer les compromis d'une décision, pas seulement la « bonne pratique »
- [ ] Appliquer systématiquement DDD et microservices à tout projet
- [x] Rendre les frontières entre modules explicites et vérifiables
> Une architecture sur-dimensionnée coûte autant qu'une architecture sous-dimensionnée. Des outils (règles ESLint `import/no-restricted-paths`, dependency-cruiser, Nx module boundaries) permettent de vérifier les frontières en CI.
[doc]: Martin Fowler — Software architecture guide (EN) | https://martinfowler.com/architecture/
