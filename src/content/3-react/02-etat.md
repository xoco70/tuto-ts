---
id: react-state
track: react
order: 2
title: État, rendu et immutabilité
level: Débutant
summary: useState, ce qu'est un rendu, mises à jour en lot, updater fonctionnel, immutabilité, état dérivé, remonter l'état, formulaires contrôlés.
---

## useState

```tsx
function Compteur() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Appeler `setCount` :
1. **planifie** un nouveau rendu (ne modifie pas `count` immédiatement) ;
2. au rendu suivant, `useState` renvoie la nouvelle valeur ;
3. React compare l'ancien et le nouveau JSX, et met à jour le DOM.

> L'état est un **instantané** (*snapshot*) : dans un rendu donné, `count` est une constante.

```tsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
  console.log(count);   // toujours l'ancienne valeur
}
// résultat : +1 seulement
```

### Updater fonctionnel

```tsx
setCount((c) => c + 1);
setCount((c) => c + 1);
setCount((c) => c + 1);   // +3 : chaque updater reçoit la valeur en attente
```

À utiliser dès que la nouvelle valeur dépend de la précédente.

### Batching

React 18+ regroupe **toutes** les mises à jour d'un même événement (y compris dans les promesses et `setTimeout`) en **un seul** rendu.

### Initialisation paresseuse

```tsx
const [data] = useState(() => calculCouteux());   // appelé une seule fois
const [data2] = useState(calculCouteux());        // ❌ appelé à chaque rendu (résultat ignoré)
```

## Immutabilité

React compare l'état avec `Object.is`. Muter un objet ne change pas sa référence → **aucun rendu**.

```tsx
// ❌
user.nom = 'Ada';
setUser(user);

// ✅
setUser({ ...user, nom: 'Ada' });
setTodos([...todos, nouveau]);                          // ajout
setTodos(todos.filter((t) => t.id !== id));             // suppression
setTodos(todos.map((t) => (t.id === id ? { ...t, fait: true } : t)));  // modification
```

`push`, `splice`, `sort`, `reverse` mutent le tableau. Alternatives non mutantes : `toSorted`, `toReversed`, `toSpliced`, `with` (ES2023). Pour des structures imbriquées complexes : **Immer** (`useImmer`).

## Ne stockez pas ce qui se calcule

```tsx
// ❌ état redondant, à synchroniser
const [items, setItems] = useState<Item[]>([]);
const [total, setTotal] = useState(0);

// ✅ état dérivé, calculé pendant le rendu
const total = items.reduce((s, i) => s + i.prix, 0);
```

Principes : pas d'état **redondant**, pas d'état **dupliqué** (stocker `selectedId` plutôt qu'une copie de l'objet sélectionné), pas de props copiées dans l'état.

## Remonter l'état (*lifting state up*)

Si deux composants frères doivent partager une donnée, l'état monte dans leur **plus proche parent commun**, qui la redescend en props avec des callbacks.

## Formulaires contrôlés

```tsx
const [email, setEmail] = useState('');
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

- **Contrôlé** : la valeur vient de l'état React (source de vérité unique).
- **Non contrôlé** : le DOM garde la valeur (`defaultValue`, lecture via `ref` ou `FormData`).
- `value` sans `onChange` → champ en lecture seule (warning).

Pour des formulaires complexes : **React Hook Form** (+ Zod), ou les **Actions** de React 19.

## Où vit l'état ?

L'état est attaché à la **position** du composant dans l'arbre. Même composant, même position → état conservé. Composant différent à cette position, ou `key` différente → état détruit.

<!-- QUIZ -->

### Que vaut `count` après un clic, s'il valait 0 ?
```tsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```
- [x] 1
- [ ] 3
- [ ] 0
- [ ] 2
> Dans ce rendu, `count` vaut 0 : les trois appels demandent tous `0 + 1`. Pour enchaîner, utiliser l'updater fonctionnel `setCount(c => c + 1)`.
[doc]: React — Mettre en file d'attente une série de mises à jour | https://fr.react.dev/learn/queueing-a-series-of-state-updates

### Que logue ce code juste après le `setCount` (count valait 5) ?
```tsx
setCount(count + 1);
console.log(count);
```
- [ ] 6
- [x] 5
- [ ] `undefined`
- [ ] Cela dépend du navigateur
> `setCount` planifie un rendu ; la variable `count` du rendu courant est une constante (snapshot). La nouvelle valeur ne sera visible qu'au prochain rendu.
[doc]: React — L'état comme un instantané | https://fr.react.dev/learn/state-as-a-snapshot

### Pourquoi l'écran ne se met-il pas à jour ?
```tsx
function ajouter(item: Item) {
  items.push(item);
  setItems(items);
}
```
- [ ] `push` ne fonctionne pas dans React
- [x] Le tableau est muté et passé avec la même référence : `Object.is` le considère inchangé, React ne re-rend pas
- [ ] Il faut appeler `forceUpdate`
- [ ] `setItems` est asynchrone
> Il faut créer un nouveau tableau : `setItems([...items, item])` ou `setItems(prev => [...prev, item])`.
[doc]: React — Mettre à jour les tableaux d'un état | https://fr.react.dev/learn/updating-arrays-in-state

### Combien de rendus provoque ce gestionnaire en React 18+ ?
```tsx
async function onClick() {
  const data = await fetchData();
  setData(data);
  setLoading(false);
  setError(null);
}
```
- [ ] 3
- [x] 1
- [ ] 0
- [ ] 2
> Depuis React 18, le *batching automatique* regroupe aussi les mises à jour faites après un `await`, dans un `setTimeout` ou dans des promesses. Avant React 18, seuls les gestionnaires d'événements React étaient regroupés.
[doc]: React — Batching | https://fr.react.dev/learn/queueing-a-series-of-state-updates#react-batches-state-updates

### Quelle est la meilleure façon de gérer `total` ?
```tsx
const [items, setItems] = useState<Item[]>([]);
```
- [ ] `const [total, setTotal] = useState(0)` mis à jour dans un `useEffect` qui surveille `items`
- [x] `const total = items.reduce((s, i) => s + i.prix, 0)` calculé pendant le rendu
- [ ] Le stocker dans une variable globale
- [ ] Le stocker dans un `useRef`
> Un état dérivé ne doit pas être stocké : il se désynchronise et le `useEffect` provoque un rendu supplémentaire avec une valeur obsolète. Si le calcul est vraiment coûteux, `useMemo`.
[doc]: React — Choisir la structure de l'état | https://fr.react.dev/learn/choosing-the-state-structure

### Quelle est la différence entre ces deux lignes ?
```tsx
const [a] = useState(calcul());
const [b] = useState(() => calcul());
```
- [ ] Aucune
- [x] `calcul()` est exécuté à chaque rendu dans la première (résultat ignoré après le premier), une seule fois dans la seconde
- [ ] La seconde stocke une fonction dans l'état
- [ ] La première est invalide
> Passer une **fonction** à `useState` active l'initialisation paresseuse. Attention : pour stocker réellement une fonction dans l'état, il faut `useState(() => maFonction)`.
[doc]: React — useState, éviter de recréer l'état initial | https://fr.react.dev/reference/react/useState#avoiding-recreating-the-initial-state

### Comment mettre à jour une propriété d'un objet en état ?
```tsx
const [user, setUser] = useState({ nom: 'Ada', ville: 'Londres' });
```
- [ ] `user.ville = 'Paris'`
- [ ] `setUser(user.ville = 'Paris')`
- [x] `setUser({ ...user, ville: 'Paris' })`
- [ ] `setUser('Paris')`
> On remplace l'objet par une copie modifiée. Contrairement à `this.setState` des composants classe, `useState` ne fusionne pas : `setUser({ ville: 'Paris' })` perdrait `nom`.
[doc]: React — Mettre à jour les objets d'un état | https://fr.react.dev/learn/updating-objects-in-state

### Deux composants frères doivent afficher et modifier le même filtre. Où placer l'état ?
- [ ] Dans chacun des deux, synchronisés par `useEffect`
- [x] Dans leur plus proche parent commun, transmis en props avec un callback de modification
- [ ] Dans une variable globale du module
- [ ] Dans `localStorage`
> C'est le principe de remonter l'état. Si de nombreux composants éloignés en ont besoin : contexte, store (Zustand, Redux) ou URL (*search params*).
[doc]: React — Partager l'état entre composants | https://fr.react.dev/learn/sharing-state-between-components

### Qu'est-ce qu'un input « contrôlé » ?
- [ ] Un input validé par le serveur
- [x] Un input dont la valeur affichée provient de l'état React (`value`) et est mise à jour via `onChange`
- [ ] Un input désactivé
- [ ] Un input avec un `ref`
> React est la source de vérité unique. Un input non contrôlé garde sa valeur dans le DOM (`defaultValue`) et on la lit à la soumission (ref, `FormData`).
[doc]: React — input contrôlé | https://fr.react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable

### Pourquoi éviter `const [nom, setNom] = useState(props.nom)` ?
- [ ] C'est une erreur de syntaxe
- [x] L'état est initialisé une seule fois : si `props.nom` change ensuite, l'état ne suit pas
- [ ] Les props ne peuvent pas être lues dans `useState`
- [ ] Cela crée une boucle infinie
> Copier une prop dans l'état la « fige ». Utiliser directement la prop, ou nommer explicitement la prop `initialNom` si l'intention est bien une valeur initiale. Pour réinitialiser : changer la `key`.
[doc]: React — Ne pas dupliquer les props dans l'état | https://fr.react.dev/learn/choosing-the-state-structure#avoid-redundant-state

### Quelles méthodes de tableau mutent le tableau d'origine et sont donc à éviter directement sur un état ? (plusieurs réponses)
- [x] `sort`
- [x] `splice`
- [ ] `map`
- [ ] `toSorted`
> `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse` mutent. `map`, `filter`, `slice`, `concat` et les ES2023 `toSorted`, `toReversed`, `toSpliced`, `with` renvoient un nouveau tableau.
[doc]: React — Mettre à jour les tableaux d'un état | https://fr.react.dev/learn/updating-arrays-in-state

### Un composant `<Compteur />` est rendu conditionnellement : `{afficher && <Compteur />}`. On masque puis réaffiche. Que devient son état ?
- [ ] Il est conservé
- [x] Il est perdu : le composant a été démonté puis remonté
- [ ] Il est restauré depuis le cache
- [ ] Il dépend de la `key`
> L'état est lié à la présence du composant à une position de l'arbre. Démonté = état détruit. Pour le conserver, remonter l'état ou masquer en CSS.
[doc]: React — Préserver et réinitialiser l'état | https://fr.react.dev/learn/preserving-and-resetting-state

### Plutôt que de stocker l'objet `selectedProduct` dans l'état, que vaut-il mieux stocker ?
- [ ] Une copie profonde de l'objet
- [x] Son identifiant `selectedId`, et retrouver l'objet dans la liste pendant le rendu
- [ ] Son index dans le tableau
- [ ] Rien, utiliser une variable globale
> Stocker une copie duplique la donnée : si le produit est modifié dans la liste, la sélection affiche une version obsolète. Un id reste la source unique.
[doc]: React — Éviter la duplication de l'état | https://fr.react.dev/learn/choosing-the-state-structure#avoid-duplication-in-state
