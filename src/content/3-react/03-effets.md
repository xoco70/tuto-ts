---
id: react-effects
track: react
order: 3
title: useEffect et synchronisation
level: Intermédiaire
summary: À quoi sert vraiment un effet, tableau de dépendances, nettoyage, StrictMode, conditions de course, et quand NE PAS utiliser d'effet.
---

## Ce qu'est un effet

Un effet **synchronise** un composant avec un **système externe** à React : une connexion WebSocket, un abonnement, un widget non-React, un timer, l'API du navigateur.

```tsx
useEffect(() => {
  const connexion = createConnection(roomId);
  connexion.connect();
  return () => connexion.disconnect();   // nettoyage
}, [roomId]);
```

- L'effet s'exécute **après** que React a mis à jour le DOM (et généralement après l'affichage).
- Le **nettoyage** s'exécute avant la ré-exécution de l'effet et au démontage.
- Pense « **démarrer / arrêter la synchronisation** », pas « cycle de vie ».

## Le tableau de dépendances

| Forme | Exécution |
| --- | --- |
| `useEffect(fn)` | après **chaque** rendu |
| `useEffect(fn, [])` | au montage seulement (+ nettoyage au démontage) |
| `useEffect(fn, [a, b])` | au montage et quand `a` ou `b` change (`Object.is`) |

**Toute valeur réactive** (props, état, valeurs dérivées) lue dans l'effet doit figurer dans les dépendances. La règle ESLint `react-hooks/exhaustive-deps` le vérifie. Mentir sur les dépendances = valeurs obsolètes (*stale closures*).

Piège : un objet ou une fonction créé pendant le rendu est **nouveau à chaque rendu** → l'effet tourne à chaque fois. Solution : le créer **dans** l'effet, ou le stabiliser (`useMemo`/`useCallback`), ou dépendre de valeurs primitives.

## StrictMode

En développement, `<StrictMode>` monte, **démonte et remonte** chaque composant une fois : l'effet s'exécute deux fois. Ce n'est pas un bug : cela révèle les effets **sans nettoyage correct**. En production, il ne s'exécute qu'une fois.

## Charger des données dans un effet (et ses pièges)

```tsx
useEffect(() => {
  let ignore = false;
  fetch(`/api/users/${id}`)
    .then((r) => r.json())
    .then((data) => { if (!ignore) setUser(data); });
  return () => { ignore = true; };     // évite la condition de course
}, [id]);
```

Sans le drapeau `ignore` (ou un `AbortController`), si `id` change vite, une réponse lente peut arriver **après** la plus récente et écraser l'affichage. Les effets pour charger des données n'ont pas de cache, pas de déduplication, provoquent des cascades : en pratique, préfère **TanStack Query**, SWR ou le chargement côté serveur (framework).

## Vous n'avez (souvent) pas besoin d'effet

| Besoin | ❌ Effet | ✅ À la place |
| --- | --- | --- |
| Valeur dérivée de props/état | `useEffect(() => setFull(a + b), [a, b])` | calcul pendant le rendu |
| Réagir à un clic | état `submitted` + effet | code dans le gestionnaire d'événement |
| Réinitialiser l'état quand une prop change | effet qui fait `setX(initial)` | `key={prop}` sur le composant |
| Notifier le parent d'un changement | effet qui appelle `onChange` | appeler `onChange` dans l'événement |
| Calcul coûteux | effet + état | `useMemo` |

## useLayoutEffect

S'exécute **avant** que le navigateur peigne l'écran, de façon synchrone. Utile pour mesurer le DOM (taille d'un tooltip) et ajuster sans clignotement. Bloque l'affichage : à réserver à ce cas.

## Événements dans un effet

Pour lire la dernière valeur d'une prop dans un effet **sans** qu'elle déclenche la resynchronisation : `useEffectEvent` (React 19.2). Avant, on passait par un `useRef` mis à jour à chaque rendu.

<!-- QUIZ -->

### Quand s'exécute la fonction de nettoyage retournée par un effet ?
- [ ] Uniquement au démontage du composant
- [x] Avant chaque nouvelle exécution de l'effet (si ses dépendances ont changé) et au démontage
- [ ] Juste après l'effet
- [ ] Jamais en production
> Le nettoyage « arrête » la synchronisation précédente avant d'en démarrer une nouvelle (ex. se déconnecter de l'ancienne room avant de rejoindre la nouvelle).
[doc]: React — Cycle de vie des effets réactifs | https://fr.react.dev/learn/lifecycle-of-reactive-effects

### Pourquoi un effet s'exécute-t-il deux fois au montage en développement ?
- [ ] C'est un bug de React
- [x] `<StrictMode>` monte, démonte et remonte les composants pour révéler les effets sans nettoyage correct
- [ ] Le tableau de dépendances est vide
- [ ] Vite recharge le module deux fois
> Si l'effet est correctement nettoyé, l'utilisateur ne voit aucune différence. En production, ce double montage n'a pas lieu.
[doc]: React — Gérer le double effet en développement | https://fr.react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development

### Pourquoi cet effet s'exécute-t-il à chaque rendu malgré le tableau de dépendances ?
```tsx
const options = { serverUrl, roomId };
useEffect(() => {
  const c = createConnection(options);
  c.connect();
  return () => c.disconnect();
}, [options]);
```
- [ ] `serverUrl` change à chaque rendu
- [x] `options` est un nouvel objet à chaque rendu : `Object.is` le considère toujours différent
- [ ] Les objets sont interdits dans les dépendances
- [ ] Il manque `roomId` dans les dépendances
> Créer l'objet **dans** l'effet et dépendre de `[serverUrl, roomId]` (des primitives). Ou le mémoïser avec `useMemo` si nécessaire.
[doc]: React — Éviter les objets en dépendances | https://fr.react.dev/learn/removing-effect-dependencies#does-some-reactive-value-change-unintentionally

### Quel problème le drapeau `ignore` résout-il ?
```tsx
useEffect(() => {
  let ignore = false;
  fetchUser(id).then((u) => { if (!ignore) setUser(u); });
  return () => { ignore = true; };
}, [id]);
```
- [ ] Il empêche le double appel en StrictMode
- [x] Une condition de course : une réponse lente pour un ancien `id` ne peut plus écraser la réponse pour l'`id` courant
- [ ] Il met la réponse en cache
- [ ] Il annule la requête HTTP
> Le nettoyage marque l'ancienne requête comme obsolète. Pour annuler réellement la requête réseau, utiliser un `AbortController` (`controller.abort()` dans le nettoyage).
[doc]: React — Charger des données dans un effet | https://fr.react.dev/learn/synchronizing-with-effects#fetching-data

### Quel est le problème de ce code ?
```tsx
const [prenom, setPrenom] = useState('');
const [nom, setNom] = useState('');
const [complet, setComplet] = useState('');
useEffect(() => { setComplet(`${prenom} ${nom}`); }, [prenom, nom]);
```
- [ ] Il manque `complet` dans les dépendances
- [x] Un état et un effet inutiles : `complet` se calcule pendant le rendu, l'effet provoque un rendu supplémentaire avec une valeur périmée
- [ ] Les template literals sont interdits
- [ ] Aucun problème
> `const complet = `${prenom} ${nom}`` suffit. Un effet qui ne fait que `setState` à partir d'autres états est presque toujours un *code smell*.
[doc]: React — Vous n'avez peut-être pas besoin d'un effet | https://fr.react.dev/learn/you-might-not-need-an-effect

### Quand utiliser `useLayoutEffect` plutôt que `useEffect` ?
- [ ] Pour charger des données plus vite
- [x] Pour mesurer le DOM et corriger la mise en page avant que le navigateur affiche l'écran (éviter un clignotement)
- [ ] Toujours, il est plus performant
- [ ] Pour les composants serveur
> `useLayoutEffect` bloque l'affichage jusqu'à la fin de son exécution. Pour tout le reste, `useEffect`.
[doc]: React — useLayoutEffect | https://fr.react.dev/reference/react/useLayoutEffect

### Que se passe-t-il si on omet une valeur réactive utilisée dans l'effet de ses dépendances ?
```tsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []);
```
- [ ] Le log affiche la valeur courante de `count`
- [x] Le log affiche toujours la valeur de `count` au premier rendu (closure obsolète)
- [ ] L'effet ne s'exécute jamais
- [ ] React lève une erreur
> L'effet capture les valeurs du rendu où il a été créé. Ajouter `count` aux dépendances (l'intervalle sera recréé), ou utiliser un updater fonctionnel / `useEffectEvent` selon le besoin.
[doc]: React — Les dépendances doivent correspondre au code | https://fr.react.dev/learn/removing-effect-dependencies

### Comment réinitialiser tout l'état d'un composant `<Profil userId={id} />` quand `userId` change ?
- [ ] Un `useEffect` qui remet chaque état à sa valeur initiale
- [x] Rendre le composant avec `key={userId}`
- [ ] Appeler `window.location.reload()`
- [ ] Ce n'est pas possible
> Une clé différente fait considérer le composant comme nouveau : React le démonte et le remonte avec un état neuf, sans rendu intermédiaire incohérent.
[doc]: React — Réinitialiser tout l'état quand une prop change | https://fr.react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes

### Pourquoi charger les données avec TanStack Query plutôt qu'un `useEffect` + `fetch` maison ?
- [ ] `fetch` ne fonctionne pas dans React
- [x] Cache, déduplication des requêtes, gestion des conditions de course, retries, revalidation et états loading/error sont fournis
- [ ] `useEffect` est déprécié
- [ ] TanStack Query est obligatoire avec TypeScript
> Les effets « faits main » cumulent pièges et code répétitif. La doc React elle-même recommande un framework ou une librairie de cache pour le data fetching.
[doc]: React — Alternatives au chargement dans un effet | https://fr.react.dev/reference/react/useEffect#what-are-good-alternatives-to-data-fetching-in-effects

### À quoi sert `useEffectEvent` (React 19.2) ?
- [ ] À remplacer `useEffect`
- [x] À lire les dernières valeurs de props/état depuis un effet sans que ces valeurs ne déclenchent sa ré-exécution
- [ ] À gérer les événements DOM
- [ ] À exécuter un effet côté serveur
> Exemple : se reconnecter quand `roomId` change, mais afficher une notification avec le `theme` courant sans se reconnecter quand le thème change.
[doc]: React — Séparer les événements des effets | https://fr.react.dev/learn/separating-events-from-effects

### Quels cas sont de bons usages de `useEffect` ? (plusieurs réponses)
- [x] S'abonner à un événement `resize` de `window` et se désabonner au nettoyage
- [x] Se connecter à un WebSocket selon un `roomId`
- [ ] Calculer un total à partir d'un tableau en état
- [ ] Envoyer un formulaire quand l'utilisateur clique sur « Envoyer »
> Les effets synchronisent avec des systèmes externes. Les calculs se font pendant le rendu, les actions utilisateur dans les gestionnaires d'événements.
[doc]: React — Synchroniser grâce aux effets | https://fr.react.dev/learn/synchronizing-with-effects

### Que fait `useEffect(fn)` sans tableau de dépendances ?
- [ ] Il s'exécute uniquement au montage
- [x] Il s'exécute après chaque rendu
- [ ] Il ne s'exécute jamais
- [ ] Erreur de compilation
> Sans tableau, l'effet se resynchronise après chaque rendu. `[]` = montage uniquement. Si l'effet modifie l'état sans condition, c'est une boucle infinie.
[doc]: React — useEffect, paramètres | https://fr.react.dev/reference/react/useEffect#parameters
