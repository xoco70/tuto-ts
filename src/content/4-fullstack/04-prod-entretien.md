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

## S'entraîner et aller plus loin

- **System design** : le [System Design Primer](https://github.com/donnemartin/system-design-primer) (en anglais) propose une [méthode pour aborder la question](https://github.com/donnemartin/system-design-primer#how-to-approach-a-system-design-interview-question), proche de celle ci-dessus, puis des [exercices corrigés](https://github.com/donnemartin/system-design-primer#system-design-interview-questions-with-solutions) (Pastebin, fil Twitter, web crawler, passer à des millions d'utilisateurs…). Il propose aussi une [liste de questions supplémentaires](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).
- **Production Node** : [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md) (traduction française de 2023), sections [Mise en production](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md#5-pratiques-de-mise-en-production) (19 pratiques : supervision, logs, gestion de la mémoire, `NODE_ENV`…) et [Docker](https://github.com/goldbergyoni/nodebestpractices/blob/master/README.french.md#8-bonnes-pratiques-de-docker) (15 pratiques : build multi-étapes, `.dockerignore`, arrêt propre, limites mémoire…).

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

### Quelle est la différence entre SLI, SLO et SLA ?
- [ ] Ce sont trois noms du même indicateur
- [x] SLI : la mesure (ex. % de requêtes en moins de 300 ms) ; SLO : l'objectif interne (99,5 %) ; SLA : l'engagement contractuel, avec pénalités
- [ ] SLA : la mesure ; SLI : l'objectif ; SLO : le contrat
- [ ] SLO et SLA désignent tous deux des contrats signés avec le client
> Le SLO est volontairement plus strict que le SLA pour avoir une marge avant les pénalités. Un bon SLI mesure ce que vivent les utilisateurs, pas la charge CPU.
[doc]: Google SRE — Service Level Objectives (EN) | https://sre.google/sre-book/service-level-objectives/

### Qu'est-ce qu'un « budget d'erreur » ?
- [ ] Le budget alloué à la correction des bugs
- [x] La marge d'indisponibilité autorisée par le SLO (ex. 0,1 % sur 30 jours) : tant qu'il en reste, on peut livrer et prendre des risques
- [ ] Le nombre maximal d'exceptions dans les logs
- [ ] Le coût des incidents
> Avec un SLO à 99,9 %, on peut « consommer » environ 43 minutes d'indisponibilité par mois. Budget épuisé : on ralentit les livraisons et on priorise la fiabilité. Cela transforme un débat d'opinions en règle partagée entre produit et technique.
[doc]: Google SRE — Embracing risk (EN) | https://sre.google/sre-book/embracing-risk/

### Qu'est-ce qu'un post-mortem « sans blâme » (*blameless*) ?
- [ ] Un rapport qui ne mentionne pas l'incident
- [x] Une analyse qui cherche les causes systémiques (process, outils, alertes) plutôt qu'un coupable, avec des actions de suivi
- [ ] Une réunion où personne ne parle
- [ ] Un post-mortem écrit par l'équipe de direction
> Si une personne a pu supprimer la base de production d'une seule commande, le problème est l'absence de garde-fou. Sans peur de sanction, les gens racontent ce qui s'est réellement passé — c'est la condition pour apprendre.
[doc]: Google SRE — Postmortem culture (EN) | https://sre.google/sre-book/postmortem-culture/

### Comment fonctionne un déploiement *blue/green* ?
- [ ] On déploie progressivement sur 1 %, puis 10 % des utilisateurs
- [x] Deux environnements identiques : on déploie sur celui inactif, on le teste, puis on bascule tout le trafic ; le retour arrière est une simple rebascule
- [ ] On déploie la nuit quand il n'y a pas de trafic
- [ ] On alterne les couleurs du thème pour tester l'UI
> Le blue/green offre un rollback instantané, au prix d'une double infrastructure le temps de la bascule. La base de données est partagée : les migrations doivent être compatibles avec les deux versions (expand/contract).
[doc]: Martin Fowler — Blue Green Deployment (EN) | https://martinfowler.com/bliki/BlueGreenDeployment.html

### Pourquoi une *liveness probe* Kubernetes ne devrait-elle pas vérifier la base de données ?
- [ ] Parce que Kubernetes n'a pas accès à la base
- [x] Si la base tombe, tous les pods échouent la probe et sont redémarrés en boucle, sans que cela ne répare rien
- [ ] Parce que la probe serait trop rapide
- [ ] Elle devrait, c'est la bonne pratique
> La liveness répond à « le processus est-il bloqué ? » ; un redémarrage doit pouvoir le réparer. Les dépendances relèvent de la **readiness**, qui retire le pod du trafic sans le tuer.
[doc]: Kubernetes — Liveness, readiness et startup probes (EN) | https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/

### Quelle bonne pratique de sécurité appliquer à l'image Docker d'une API Node ?
- [ ] Exécuter le processus en `root` pour éviter les problèmes de permissions
- [x] Exécuter le processus avec un utilisateur non privilégié (`USER node` dans les images officielles)
- [ ] Copier le dossier `.git` dans l'image pour tracer la version
- [ ] Installer les outils de compilation dans l'image finale
> En cas de faille dans l'application, un processus non-root limite ce qu'un attaquant peut faire dans le conteneur. Avec un `.dockerignore` (`node_modules`, `.env`, `.git`) et un build multi-stage, l'image finale reste petite et sans secret.
[doc]: Docker Node — Best practices, non-root user (EN) | https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#non-root-user

### Qu'est-ce que le *trunk-based development* ?
- [ ] Une branche longue par fonctionnalité, fusionnée en fin de sprint
- [x] Des branches très courtes (ou des commits directs) intégrées au tronc au moins quotidiennement, les fonctionnalités inachevées étant masquées par des feature flags
- [ ] Un dépôt par microservice
- [ ] Une stratégie réservée aux projets open source
> Intégrer souvent réduit les conflits de merge et garde le tronc toujours déployable. Ce modèle suppose une CI rapide et fiable, et des feature flags pour découpler déploiement et mise en production.
[doc]: Trunk Based Development (EN) | https://trunkbaseddevelopment.com/

### Sur quoi un relecteur senior doit-il concentrer sa revue de code ?
- [ ] Sur les espaces et les points-virgules
- [x] Sur la conception, la justesse, les cas limites, les tests et la lisibilité ; le formatage est délégué au linter et à Prettier
- [ ] Sur le nombre de lignes modifiées
- [ ] Sur le respect de ses préférences personnelles
> Le guide de Google résume : la revue doit améliorer la santé globale du code, sans viser la perfection. Distinguer clairement les points bloquants des suggestions (« nit: ») rend les échanges plus efficaces.
[doc]: Google — What to look for in a code review (EN) | https://google.github.io/eng-practices/review/reviewer/looking-for.html

### Une librairie interne passe de `2.4.1` à `3.0.0` selon SemVer. Qu'est-ce que cela signale ?
- [ ] Un correctif de bug
- [ ] Une nouvelle fonctionnalité rétrocompatible
- [x] Un changement cassant pour les utilisateurs de l'API publique
- [ ] Rien de particulier, c'est arbitraire
> MAJEUR.MINEUR.CORRECTIF : majeur pour un changement incompatible, mineur pour un ajout compatible, correctif pour une correction compatible. `^2.4.1` dans un `package.json` accepte les `2.x.y` mais pas la `3.0.0`.
[doc]: Semantic Versioning | https://semver.org/lang/fr/

### En entretien de system design, un service doit traiter 1 million de requêtes par jour. Quel débit moyen cela représente-t-il ?
- [ ] Environ 1 requête par seconde
- [x] Environ 12 requêtes par seconde
- [ ] Environ 100 requêtes par seconde
- [ ] Environ 1 000 requêtes par seconde
> 1 000 000 / 86 400 s ≈ 11,6 req/s en moyenne. Le pic peut atteindre plusieurs fois cette valeur selon la répartition dans la journée. Ces calculs « au dos de l'enveloppe » montrent vite qu'une seule instance bien écrite suffit souvent.
[doc]: System Design Primer — Back-of-the-envelope (EN) | https://github.com/donnemartin/system-design-primer#appendix

### Que faut-il éviter d'écrire dans les logs applicatifs ?
- [ ] Les identifiants de corrélation
- [ ] Les codes de statut HTTP
- [x] Les mots de passe, tokens, numéros de carte et données personnelles non nécessaires
- [ ] Les durées de traitement
> Les logs sont copiés, indexés et conservés longtemps, souvent avec des accès larges. Masquez les champs sensibles à la source (option `redact` de pino) et loggez des identifiants plutôt que des données personnelles.
[doc]: OWASP — Logging Cheat Sheet (EN) | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

### Que mesure la méthode RED pour un service ?
- [ ] Ressources, Erreurs, Disque
- [x] Rate (débit de requêtes), Errors (taux d'erreurs), Duration (latence)
- [ ] Redis, Elasticsearch, Docker
- [ ] Réplication, Élasticité, Disponibilité
> RED donne trois métriques par service orientées utilisateur, idéales pour un premier tableau de bord. Sa cousine USE (Utilization, Saturation, Errors) s'applique aux ressources : CPU, mémoire, pool de connexions.
[doc]: Grafana — The RED Method (EN) | https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/
