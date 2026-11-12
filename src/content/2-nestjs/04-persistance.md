---
id: nest-persistence
track: nestjs
order: 4
title: Persistance - TypeORM, Prisma, transactions
level: Avancé
summary: Repository pattern, TypeORM vs Prisma, migrations, transactions, N+1, verrouillage optimiste, pagination.
---

## Deux ORM dominants

| | TypeORM | Prisma |
| --- | --- | --- |
| Modèle | classes `@Entity` décorées | fichier `schema.prisma` → client généré |
| Typage des requêtes | partiel (`find` typé, QueryBuilder moins) | très fort (types générés, `select` reflété dans le type) |
| Pattern | Data Mapper / Active Record | client de requêtes |
| Intégration Nest | `@nestjs/typeorm` | un `PrismaService extends PrismaClient` |

Drizzle et MikroORM sont aussi rencontrés (MikroORM : Unit of Work + Identity Map).

### TypeORM dans Nest

```ts
@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => User, (u) => u.orders) user!: User;
  @Column('decimal', { precision: 10, scale: 2 }) total!: string;
  @VersionColumn() version!: number;
}

@Injectable()
export class OrdersService {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}
}
```

`synchronize: true` aligne le schéma sur les entités au démarrage : **jamais en production** (perte de données possible). En prod, on utilise des **migrations** versionnées et revues.

### Prisma dans Nest

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.$connect(); }
}

const user = await this.prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true },   // le type retourné ne contient que id et email
});
```

## Transactions

Une transaction garantit l'**atomicité** : tout ou rien.

```ts
// TypeORM
await this.dataSource.transaction(async (manager) => {
  await manager.decrement(Stock, { productId }, 'quantity', 1);
  await manager.save(Order, order);       // ⚠️ utiliser `manager`, pas le repository injecté
});

// Prisma (transaction interactive)
await this.prisma.$transaction(async (tx) => {
  const account = await tx.account.update({ where: { id }, data: { balance: { decrement: 100 } } });
  if (account.balance < 0) throw new Error('Solde insuffisant');   // → rollback
});
```

Piège n°1 : utiliser un repository injecté **à l'intérieur** du callback → la requête part sur une autre connexion, **hors** transaction. Pour propager une transaction à travers plusieurs services sans passer le `manager` partout : `AsyncLocalStorage` (ex. `@nestjs-cls/transactional`).

Ne jamais faire d'appel réseau lent (API de paiement, email) **dans** une transaction : elle garde des verrous ouverts. Pattern *outbox* : écrire l'événement en base dans la transaction, l'envoyer ensuite.

## Le problème N+1

```ts
const orders = await repo.find();                 // 1 requête
for (const o of orders) {
  o.user = await userRepo.findOneBy({ id: o.userId });   // + N requêtes
}
```

Solutions : jointure (`relations: ['user']`, `include`), `IN (...)` en une requête, ou **DataLoader** (batch + cache par requête, indispensable en GraphQL).

## Concurrence

- **Verrouillage optimiste** : colonne `version` ; un `UPDATE ... WHERE version = :v` qui touche 0 ligne signale un conflit → réessayer ou renvoyer 409.
- **Verrouillage pessimiste** : `SELECT ... FOR UPDATE` dans une transaction (`lock: { mode: 'pessimistic_write' }`).
- Mises à jour atomiques plutôt que lire-modifier-écrire : `UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0`.

## Pagination

| Offset (`LIMIT/OFFSET`) | Curseur (*keyset*) |
| --- | --- |
| simple, accès page N | stable et performant sur gros volumes |
| lent sur grands offsets, doublons/trous si insertions | pas de saut direct à la page N |

```sql
SELECT * FROM orders WHERE (created_at, id) < (:lastCreatedAt, :lastId)
ORDER BY created_at DESC, id DESC LIMIT 20;
```

## Repository pattern et tests

Encapsuler l'accès aux données derrière une interface métier (`OrdersRepository` avec `findPendingForUser()`) plutôt que d'exposer le query builder partout facilite les tests unitaires (mock du repository) et un éventuel changement d'ORM. Les tests d'intégration, eux, tournent sur une **vraie base** (Testcontainers, base Docker jetable).

<!-- QUIZ -->

### Pourquoi ne jamais activer `synchronize: true` en production avec TypeORM ?
- [ ] C'est plus lent au démarrage
- [x] TypeORM modifie le schéma automatiquement pour coller aux entités, ce qui peut supprimer des colonnes et donc des données
- [ ] Cela désactive les transactions
- [ ] Cela n'est pas supporté par PostgreSQL
> Renommer une propriété peut se traduire par un `DROP COLUMN` + `ADD COLUMN`. En production, seules des **migrations** versionnées, relues et rejouables doivent modifier le schéma.
[doc]: TypeORM — Migrations (EN) | https://typeorm.io/docs/advanced-topics/migrations

### Dans ce code, quelle requête n'est pas incluse dans la transaction ?
```ts
await this.dataSource.transaction(async (manager) => {
  await manager.save(Order, order);
  await this.paymentsRepository.save(payment);
});
```
- [ ] `manager.save(Order, order)`
- [x] `this.paymentsRepository.save(payment)` : le repository injecté utilise une autre connexion
- [ ] Aucune, les deux sont transactionnelles
- [ ] Les deux sont hors transaction
> Dans une transaction TypeORM, toutes les opérations doivent passer par le `manager` fourni (ou `manager.getRepository(Payment)`). Sinon, en cas d'erreur, le paiement est committé alors que la commande est annulée.
[doc]: TypeORM — Transactions (EN) | https://typeorm.io/docs/advanced-topics/transactions

### Comment Prisma déclenche-t-il le rollback d'une transaction interactive ?
```ts
await prisma.$transaction(async (tx) => { ... });
```
- [ ] En appelant `tx.rollback()`
- [x] En levant une exception dans le callback
- [ ] En retournant `false`
- [ ] Prisma ne supporte pas le rollback
> Si le callback lève, Prisma annule la transaction et propage l'erreur. Les transactions interactives ont un timeout (5 s par défaut) : ne pas y mettre d'appels lents.
[doc]: Prisma — Interactive transactions (EN) | https://www.prisma.io/docs/orm/prisma-client/queries/transactions#interactive-transactions

### Qu'est-ce que le problème N+1 ?
- [ ] Une erreur de pagination qui renvoie une ligne en trop
- [x] Exécuter 1 requête pour une liste puis 1 requête supplémentaire par élément pour charger une relation
- [ ] Un deadlock entre N transactions
- [ ] Un index manquant sur une clé étrangère
> 100 commandes = 101 requêtes. Solutions : jointure/`include`, une requête `WHERE id IN (...)`, ou DataLoader qui regroupe les chargements d'un même tick. Les logs SQL ou un APM le révèlent vite.
[doc]: Prisma — Query optimization, N+1 (EN) | https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance

### Deux requêtes modifient la même commande en parallèle. Avec une colonne `@VersionColumn`, que se passe-t-il ?
- [ ] La dernière écriture gagne silencieusement
- [x] La seconde mise à jour détecte que la version a changé et échoue (verrouillage optimiste) : on peut réessayer ou renvoyer 409
- [ ] La base se bloque jusqu'au redémarrage
- [ ] Les deux mises à jour sont fusionnées
> Le verrouillage optimiste suppose que les conflits sont rares : pas de verrou, mais une vérification de version à l'écriture. Côté HTTP, cela se traduit souvent par un `ETag` / `If-Match` et un statut 409 ou 412.
[doc]: TypeORM — Entities, special columns (EN) | https://typeorm.io/docs/entity/entities#special-columns

### Quel est l'inconvénient principal de la pagination `LIMIT 20 OFFSET 100000` ?
- [ ] Elle ne fonctionne pas avec PostgreSQL
- [x] La base doit parcourir et jeter 100 000 lignes : c'est de plus en plus lent, et les insertions concurrentes provoquent doublons ou trous
- [ ] Elle ne permet pas de trier
- [ ] Elle renvoie toujours la première page
> La pagination par curseur (*keyset*) — `WHERE (created_at, id) < (...) ORDER BY ... LIMIT 20` — utilise un index et reste constante, au prix de ne pas pouvoir sauter directement à la page N.
[doc]: Prisma — Cursor-based pagination (EN) | https://www.prisma.io/docs/orm/prisma-client/queries/pagination#cursor-based-pagination

### Pourquoi éviter d'appeler l'API Stripe à l'intérieur d'une transaction SQL ?
- [ ] Stripe refuse les appels depuis une transaction
- [x] La transaction garde des verrous et une connexion du pool pendant toute la latence réseau ; et un rollback n'annule pas le paiement déjà effectué
- [ ] Les transactions ne supportent pas `await`
- [ ] Ce n'est pas un problème
> Les effets externes ne sont pas transactionnels. Pattern **outbox** : enregistrer l'intention dans la même transaction que les données, puis un worker l'exécute (avec idempotence et reprise).
[doc]: microservices.io — Transactional outbox (EN) | https://microservices.io/patterns/data/transactional-outbox.html

### Avec Prisma, quel est le type de `user` ?
```ts
const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
```
- [ ] `User`
- [x] `{ email: string } | null`
- [ ] `{ email: string }`
- [ ] `Partial<User>`
> Le client Prisma génère des types qui reflètent le `select`/`include`. `findUnique` peut ne rien trouver → `| null` (`findUniqueOrThrow` lève à la place).
[doc]: Prisma — Select fields (EN) | https://www.prisma.io/docs/orm/prisma-client/queries/select-fields

### Comment décrémenter un stock sans risque de condition de course (*race condition*) ?
- [ ] Lire le stock, vérifier en JS, puis écrire la nouvelle valeur
- [x] Une mise à jour atomique : `UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0`, puis vérifier le nombre de lignes affectées
- [ ] Mettre le service en `Scope.REQUEST`
- [ ] Ajouter un `setTimeout` entre lecture et écriture
> Le schéma lire-modifier-écrire entre deux requêtes concurrentes peut vendre deux fois le dernier article. La base garantit l'atomicité d'un `UPDATE` unique. Alternatives : `SELECT ... FOR UPDATE` ou verrouillage optimiste.
[doc]: PostgreSQL — Explicit locking (EN) | https://www.postgresql.org/docs/current/explicit-locking.html

### Comment injecter un repository TypeORM pour l'entité `User` dans un service ?
- [ ] `constructor(private repo: Repository<User>) {}`
- [x] `constructor(@InjectRepository(User) private repo: Repository<User>) {}` avec `TypeOrmModule.forFeature([User])` dans le module
- [ ] `constructor(@Inject('User') private repo: User) {}`
- [ ] `new Repository(User)`
> `Repository<User>` est générique : sa métadonnée runtime est juste `Repository`, insuffisant pour distinguer les entités. `@InjectRepository(User)` fournit le bon token, enregistré par `forFeature`.
[doc]: NestJS — Database, repository pattern (EN) | https://docs.nestjs.com/techniques/database#repository-pattern

### Quel est l'intérêt d'un `PrismaService extends PrismaClient` déclaré comme provider ?
- [ ] Prisma l'exige
- [x] Une seule instance (et un seul pool de connexions) partagée et injectable, avec connexion/déconnexion gérées par les hooks de cycle de vie
- [ ] Il permet d'utiliser les décorateurs TypeORM
- [ ] Il rend les requêtes synchrones
> Instancier `new PrismaClient()` dans chaque service multiplierait les pools de connexions et épuiserait la base. Le singleton Nest résout ce problème.
[doc]: NestJS — Prisma recipe (EN) | https://docs.nestjs.com/recipes/prisma

### Pour des tests d'intégration fiables de la couche de persistance, quelle approche est recommandée ?
- [ ] Mocker l'ORM entièrement
- [x] Utiliser une vraie base jetable du même moteur (Testcontainers, conteneur Docker), migrations appliquées
- [ ] Utiliser SQLite en mémoire même si la prod est en PostgreSQL
- [ ] Tester directement sur la base de production
> SQLite diffère de PostgreSQL/MySQL (types, contraintes, collations, `FOR UPDATE`…) : des tests verts peuvent cacher des bugs. Testcontainers démarre un vrai moteur par suite de tests.
[doc]: Testcontainers for Node.js (EN) | https://node.testcontainers.org/

### Quelles techniques évitent le problème N+1 ? (plusieurs réponses)
- [x] Charger la relation par jointure (`relations`, `include`)
- [x] Regrouper les chargements avec DataLoader
- [x] Une seule requête `WHERE user_id IN (...)` puis un regroupement en mémoire
- [ ] Mettre la requête dans une boucle `for await`
> Les trois réduisent N requêtes à 1 ou 2. DataLoader est particulièrement adapté à GraphQL, où les resolvers de champs sont appelés élément par élément.
[doc]: DataLoader (EN) | https://github.com/graphql/dataloader

### PostgreSQL crée-t-il automatiquement un index sur une clé étrangère `orders.user_id` ?
- [ ] Oui, comme pour une clé primaire
- [x] Non : seule la colonne référencée (clé primaire ou unique) est indexée, il faut indexer `user_id` soi-même
- [ ] Oui, mais seulement avec TypeORM
- [ ] Non, et ce serait inutile
> Les jointures `orders ↔ users` et les `ON DELETE CASCADE` deviennent lentes sans index sur la colonne de clé étrangère. Avec TypeORM : `@Index()` ; avec Prisma : `@@index([userId])`.
[doc]: PostgreSQL — Foreign keys (EN) | https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

### Quel est le niveau d'isolation par défaut de PostgreSQL ?
- [ ] Read Uncommitted
- [x] Read Committed
- [ ] Repeatable Read
- [ ] Serializable
> En Read Committed, chaque requête voit les données validées au moment où **elle** démarre : deux `SELECT` dans une même transaction peuvent donc voir des valeurs différentes. Pour un « lire puis modifier » sûr, on utilise un `UPDATE` conditionnel, un verrou (`FOR UPDATE`) ou un niveau plus strict.
[doc]: PostgreSQL — Transaction isolation (EN) | https://www.postgresql.org/docs/current/transaction-iso.html

### Que fait `SELECT … FROM accounts WHERE id = $1 FOR UPDATE` dans une transaction ?
- [ ] Il verrouille toute la table
- [x] Il verrouille la ligne : les autres transactions qui veulent la modifier (ou la verrouiller) attendent la fin de la transaction
- [ ] Il empêche toute lecture de la ligne
- [ ] Il crée une copie de la ligne
> C'est le **verrouillage pessimiste**, adapté aux conflits fréquents (soldes, stocks). Avec TypeORM : `lock: { mode: 'pessimistic_write' }`. À combiner avec des transactions courtes pour éviter les attentes et les deadlocks.
[doc]: PostgreSQL — Row-level locks (EN) | https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS

### Que faire d'une migration produite par `typeorm migration:generate` ?
- [ ] La lancer directement en production, elle est fiable
- [x] La relire : elle compare entités et schéma, et peut par exemple traduire un renommage en `DROP` + `ADD` (perte de données)
- [ ] La supprimer, `synchronize` suffit
- [ ] La convertir en `synchronize: true`
> La génération est un point de départ. Un renommage de colonne, une conversion de type ou l'ajout d'une colonne `NOT NULL` sur une grosse table demandent souvent une migration écrite à la main (et parfois en plusieurs déploiements).
[doc]: TypeORM — Migrations (EN) | https://typeorm.io/docs/advanced-topics/migrations

### Avec Prisma, quelle est la différence entre `include` et `select` ?
- [ ] Aucune
- [x] `include` ajoute des relations à tous les champs scalaires ; `select` ne renvoie que les champs listés
- [ ] `select` charge les relations en lazy loading
- [ ] `include` exécute une requête SQL brute
> `select` permet de ne jamais renvoyer `passwordHash` et réduit la taille des réponses. On peut imbriquer : `select: { id: true, orders: { select: { total: true } } }`. Le type retourné suit exactement la sélection.
[doc]: Prisma — Select fields (EN) | https://www.prisma.io/docs/orm/prisma-client/queries/select-fields

### Votre API tourne sur 10 instances, chacune avec un pool de 20 connexions. PostgreSQL accepte 100 connexions. Que se passe-t-il ?
- [ ] Rien, le pool s'adapte automatiquement
- [x] Jusqu'à 200 connexions sont demandées : des instances échouent à se connecter sous charge
- [ ] PostgreSQL met les connexions en file d'attente sans limite
- [ ] Les instances partagent le même pool
> Le dimensionnement se fait **globalement** : `instances × taille du pool ≤ max_connections` (moins une marge pour migrations et admin). Au-delà, on ajoute un pooler (PgBouncer) ou on réduit le pool par instance.
[doc]: Prisma — Connection pool (EN) | https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool

### Comment insérer un événement reçu deux fois (webhook rejoué) sans doublon ni erreur ?
- [ ] `SELECT` puis `INSERT` si absent
- [x] Une contrainte unique sur l'identifiant de l'événement et `INSERT … ON CONFLICT DO NOTHING` (ou `upsert`)
- [ ] Un `try/catch` qui ignore toutes les erreurs SQL
- [ ] Un verrou applicatif en mémoire
> Le « vérifier puis insérer » est vulnérable aux requêtes concurrentes. `ON CONFLICT` délègue l'arbitrage à la base, de façon atomique. C'est la base de l'idempotence des consommateurs de webhooks et de messages.
[doc]: PostgreSQL — INSERT … ON CONFLICT (EN) | https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT

### Que fait `@DeleteDateColumn()` dans une entité TypeORM ?
- [ ] Il supprime la ligne à une date donnée
- [x] Il active le *soft delete* : `softRemove()` renseigne la date et les `find` excluent ces lignes par défaut
- [ ] Il archive la ligne dans une autre table
- [ ] Il enregistre la date de dernière modification
> Le soft delete conserve l'historique, mais a un coût : les contraintes uniques doivent en tenir compte (index partiel `WHERE deleted_at IS NULL`) et les requêtes SQL brutes doivent filtrer elles-mêmes. Pour le RGPD, une suppression logique ne suffit pas toujours.
[doc]: TypeORM — Special columns (EN) | https://typeorm.io/docs/entity/entities#special-columns
