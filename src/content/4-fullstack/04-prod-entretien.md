---
id: fs-prod-entretien
track: fullstack
order: 4
title: Production, DevOps et entretien senior
level: Senior
summary: Docker, CI/CD, 12-factor, observabilité, déploiements sans interruption, feature flags, incidents — et comment réussir un entretien fullstack senior.
---

## Conteneuriser une app Node

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

- **Multi-stage** : l'image finale ne contient ni sources, ni outils de build.
- Copier `package*.json` **avant** le code pour profiter du cache des couches.
- `USER node` : ne pas tourner en root.
- `CMD ["node", ...]` (forme exec) : Node reçoit directement `SIGTERM` → arrêt propre. Éviter `npm start` comme PID 1.
- `.dockerignore` (node_modules, .env, .git).

## 12-factor (l'essentiel)

Config dans l'**environnement**, processus **stateless**, logs sur **stdout**, mêmes artefacts dans tous les environnements (on promeut une image, on ne la reconstruit pas), parité dev/prod, démarrage rapide et arrêt gracieux.

## CI/CD

Pipeline typique : install (`npm ci`, cache) → lint → `tsc --noEmit` → tests unitaires → tests d'intégration (services Docker) → build de l'image → déploiement staging → tests e2e/smoke → production.

- **Migrations de base** : compatibles avec l'ancienne **et** la nouvelle version du code (*expand / contract*) : ajouter la colonne → déployer le code qui écrit les deux → migrer les données → retirer l'ancienne colonne plus tard.
- Déploiements **rolling**, **blue/green** ou **canary** ; rollback rapide.
- **Feature flags** : découpler déploiement et mise en production d'une fonctionnalité, activer progressivement.

## Observabilité

| Pilier | Question | Outil |
| --- | --- | --- |
| **Logs** | que s'est-il passé ? | JSON structuré, corrélé par `traceId` |
| **Métriques** | combien, à quelle vitesse ? | Prometheus, RED (Rate, Errors, Duration) |
| **Traces** | où passe le temps sur un parcours distribué ? | OpenTelemetry → Tempo, Jaeger, Datadog |

+ suivi des erreurs (Sentry) côté back **et** front. Alerter sur les **symptômes** visibles par l'utilisateur (taux d'erreur, latence p99) via des **SLO**, pas sur chaque CPU à 80 %.

## Incidents

Mitiger d'abord (rollback, feature flag off), comprendre ensuite. Post-mortem **sans blâme** : chronologie, cause racine, actions correctives suivies.

## Réussir l'entretien fullstack senior

### Ce qui est évalué

1. **Profondeur technique** : expliquer *pourquoi*, pas seulement *comment* (event loop, rendu React, DI Nest, transactions).
2. **Conception** : découper un système, choisir et justifier des compromis.
3. **Qualité** : tests, lisibilité, sécurité, observabilité.
4. **Leadership** : revues de code, mentorat, décisions d'équipe, gestion de la dette.
5. **Communication** : clarifier le besoin avant de coder, raisonner à voix haute.

### System design : une méthode

1. **Clarifier** les exigences fonctionnelles et non fonctionnelles (volume, latence, cohérence, disponibilité).
2. **Estimer** les ordres de grandeur (requêtes/s, stockage).
3. **API** et **modèle de données**.
4. **Architecture** de haut niveau (clients, API, base, cache, queue, stockage objet, CDN).
5. **Approfondir** les points critiques (concurrence, idempotence, montée en charge, pannes).
6. **Compromis** et évolutions.

### Les questions comportementales

Méthode **STAR** : Situation, Tâche, Action (la **tienne**, au « je »), Résultat (chiffré si possible). Prépare 5–6 histoires : un incident, un désaccord technique, un mentorat, une refonte, un échec et ce que tu en as appris.

### Arguments pour un profil backend qui passe fullstack

Mets en avant ce que le backend apporte au front : contrats d'API typés, gestion d'erreurs, sécurité (XSS, CSRF, stockage des tokens), performance (cache, pagination), tests. Montre un projet fullstack TS complet (monorepo NestJS + React/Next.js, CI, tests, déployé).

<!-- QUIZ -->

### Pourquoi utiliser un build Docker multi-stage pour une application NestJS ?
- [ ] Pour lancer plusieurs conteneurs
- [x] Pour que l'image finale ne contienne que le code compilé et les dépendances de production, sans sources, outils de build ni devDependencies
- [ ] Pour accélérer Node à l'exécution
- [ ] C'est obligatoire avec TypeScript
> Image plus petite, surface d'attaque réduite, démarrage plus rapide. Le premier stage compile, le second ne copie que `dist` et les `node_modules` de prod.
[doc]: Docker — Multi-stage builds (EN) | https://docs.docker.com/build/building/multi-stage/

### Pourquoi éviter `CMD ["npm", "start"]` comme processus principal d'un conteneur ?
- [ ] npm n'est pas installé dans les images Node
- [x] npm peut ne pas relayer correctement `SIGTERM` à Node : l'application ne s'arrête pas proprement et est tuée après le délai de grâce
- [ ] C'est plus lent au démarrage uniquement
- [ ] npm consomme trop de mémoire
> Lancer directement `node dist/main.js` (forme exec) fait de Node le PID 1 qui reçoit les signaux, ce qui permet le *graceful shutdown* (`enableShutdownHooks`).
[doc]: Node.js Docker best practices (EN) | https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals

### Comment renommer une colonne en production sans interruption de service ?
- [ ] Une migration `RENAME COLUMN` déployée en même temps que le code
- [x] Expand/contract : ajouter la nouvelle colonne, déployer un code qui écrit dans les deux et lit la nouvelle, migrer les données, puis supprimer l'ancienne colonne dans un déploiement ultérieur
- [ ] Arrêter l'application la nuit
- [ ] Utiliser `synchronize: true`
> Pendant un déploiement progressif, ancienne et nouvelle version du code tournent en même temps : chaque migration doit être compatible avec les deux.
[doc]: Martin Fowler — Parallel Change (EN) | https://martinfowler.com/bliki/ParallelChange.html

### À quoi servent les feature flags ?
- [ ] À remplacer les tests
- [x] À découpler le déploiement du code de l'activation d'une fonctionnalité : activation progressive, ciblée, et désactivation instantanée en cas de problème
- [ ] À chiffrer la configuration
- [ ] À versionner l'API
> Ils permettent le *trunk-based development* et les canary releases. Revers : dette si on ne supprime pas les flags obsolètes.
[doc]: Martin Fowler — Feature Toggles (EN) | https://martinfowler.com/articles/feature-toggles.html

### Quels sont les trois piliers de l'observabilité ?
- [ ] CPU, mémoire, disque
- [x] Logs, métriques, traces
- [ ] Tests, lint, build
- [ ] Dev, staging, production
> Les logs racontent des événements, les métriques agrègent des chiffres dans le temps, les traces suivent une requête à travers les services. OpenTelemetry unifie leur collecte.
[doc]: OpenTelemetry — Concepts d'observabilité (FR) | https://opentelemetry.io/fr/docs/concepts/observability-primer/

### Sur quoi faut-il alerter en priorité ?
- [ ] Chaque pic de CPU au-dessus de 80 %
- [x] Les symptômes visibles par les utilisateurs : taux d'erreur, latence au-delà du SLO, indisponibilité
- [ ] Chaque log de niveau `warn`
- [ ] Le nombre de commits par jour
> Des alertes sur les causes (CPU, mémoire) génèrent du bruit et de la fatigue d'alerte. Les SLO et le *burn rate* du budget d'erreur ciblent ce qui compte.
[doc]: Google SRE Book — Monitoring distributed systems (EN) | https://sre.google/sre-book/monitoring-distributed-systems/

### Selon les 12-factor apps, où doit se trouver la configuration (URL de base, secrets) ?
- [ ] Dans le code source, par environnement
- [x] Dans les variables d'environnement (ou un gestionnaire de secrets injecté à l'exécution)
- [ ] Dans l'image Docker
- [ ] Dans un fichier commité `config.prod.json`
> La même image est promue de staging à production : seule la configuration change. Les secrets ne doivent jamais être commités.
[doc]: The Twelve-Factor App — Configuration (FR) | https://12factor.net/fr/config

### Une mise en production provoque des erreurs 500. Quelle est la première action ?
- [ ] Chercher la cause racine dans le code avant toute action
- [x] Mitiger : rollback ou désactivation du feature flag, puis analyser une fois le service rétabli
- [ ] Attendre que ça passe
- [ ] Redémarrer la base de données
> La priorité est de restaurer le service. L'analyse et le post-mortem sans blâme viennent ensuite.
[doc]: Google SRE Book — Managing incidents (EN) | https://sre.google/sre-book/managing-incidents/

### Dans un exercice de system design, que faire en premier ?
- [ ] Dessiner immédiatement des microservices
- [x] Clarifier les exigences fonctionnelles et non fonctionnelles (volumes, latence, cohérence attendue) avant de proposer une architecture
- [ ] Choisir la base de données
- [ ] Écrire du code
> L'évaluateur observe la démarche. Une architecture brillante pour le mauvais problème est un échec. Poser les hypothèses à voix haute.
[doc]: System Design Primer (EN) | https://github.com/donnemartin/system-design-primer#how-to-approach-a-system-design-interview-question

### Que signifie la méthode STAR pour les questions comportementales ?
- [ ] Stack, Tests, Architecture, Release
- [x] Situation, Tâche, Action, Résultat
- [ ] Sécurité, Temps, Accessibilité, Robustesse
- [ ] Senior, Tech lead, Architecte, Responsable
> Structure une réponse concrète : contexte bref, ton objectif, **tes** actions (au « je »), résultat mesurable et ce que tu as appris.
[doc]: Wikipedia — STAR method (EN) | https://en.wikipedia.org/wiki/Situation,_task,_action,_result

### Dans une stratégie de déploiement « canary », que fait-on ?
- [ ] On déploie sur tous les serveurs en même temps
- [x] On expose la nouvelle version à une petite fraction du trafic, on surveille les métriques, puis on élargit progressivement (ou on revient en arrière)
- [ ] On déploie uniquement la nuit
- [ ] On garde deux environnements complets et on bascule tout d'un coup
> Le basculement complet entre deux environnements, c'est le blue/green. Le canary limite le rayon d'impact d'un bug.
[doc]: Martin Fowler — Canary Release (EN) | https://martinfowler.com/bliki/CanaryRelease.html

### Quel ordre d'étapes est le plus pertinent dans un pipeline de CI ?
- [ ] Déploiement → tests → lint
- [x] Lint et vérification des types → tests unitaires → tests d'intégration → build de l'artefact → déploiement
- [ ] Build → déploiement → lint
- [ ] Tests e2e en production uniquement
> On place les vérifications rapides en premier (*fail fast*), et on construit un artefact unique promu ensuite d'environnement en environnement.
[doc]: GitHub Actions — Building and testing Node.js (EN) | https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs

### Quels éléments renforcent une candidature de dev backend vers un poste fullstack senior TypeScript ? (plusieurs réponses)
- [x] Un projet fullstack TS complet et déployé (NestJS + React, tests, CI)
- [x] Savoir expliquer les compromis de ses choix techniques
- [x] Des exemples concrets de mentorat, de revue de code ou de gestion d'incident
- [ ] Lister le maximum de frameworks sur le CV sans projet associé
> Les recruteurs seniors cherchent profondeur, jugement et impact, pas une liste de mots-clés. Un projet démontrable sert de support de discussion pendant l'entretien.
[doc]: roadmap.sh — Full Stack Developer (EN) | https://roadmap.sh/full-stack
