---
id: react-hooks
track: react
order: 4
title: Hooks avancés, contexte et custom hooks
level: Intermédiaire
summary: useRef, useReducer, useContext, useMemo / useCallback, règles des hooks, custom hooks, useSyncExternalStore, gestion d'état global.
---

## Règles des hooks

1. N'appeler les hooks **qu'au niveau supérieur** d'un composant ou d'un custom hook : jamais dans une condition, une boucle ou après un `return` anticipé.
2. N'appeler les hooks **que** depuis des composants React ou des custom hooks.

React identifie chaque hook par son **ordre d'appel** : un hook conditionnel décale tous les suivants.

## useRef

```tsx
const inputRef = useRef<HTMLInputElement>(null);
<input ref={inputRef} />
inputRef.current?.focus();

const renderCount = useRef(0);   // valeur mutable qui survit aux rendus
renderCount.current++;            // ne déclenche PAS de rendu
```

- Pour accéder au DOM, ou stocker une valeur mutable qui ne doit pas provoquer de rendu (id de timer, instance d'une lib).
- Ne pas lire/écrire `ref.current` **pendant le rendu** (sauf initialisation paresseuse) : le rendu doit rester pur.

## useReducer

```tsx
type Action = { type: 'ajouter'; item: Item } | { type: 'retirer'; id: string } | { type: 'vider' };

function panierReducer(state: Item[], action: Action): Item[] {
  switch (action.type) {
    case 'ajouter': return [...state, action.item];
    case 'retirer': return state.filter((i) => i.id !== action.id);
    case 'vider':   return [];
  }
}

const [panier, dispatch] = useReducer(panierReducer, []);
dispatch({ type: 'ajouter', item });
```

Intérêts : logique de transition **centralisée et testable** (fonction pure), actions typées par union discriminée, `dispatch` est **stable**. Bon choix dès que plusieurs états évoluent ensemble.

## useContext

```tsx
const ThemeContext = createContext<'clair' | 'sombre'>('clair');

function App() {
  const [theme, setTheme] = useState<'clair' | 'sombre'>('clair');
  return <ThemeContext value={theme}><Page /></ThemeContext>;   // React 19 ; avant : <ThemeContext.Provider>
}

function Bouton() {
  const theme = useContext(ThemeContext);   // ou use(ThemeContext) en React 19
}
```

- Le contexte évite le *prop drilling* pour des données **globales** et peu changeantes (thème, utilisateur, locale).
- **Tous les consommateurs** re-rendent quand la `value` change (comparaison `Object.is`). Passer `value={{ user, setUser }}` crée un nouvel objet à chaque rendu → mémoïser ou séparer en deux contextes.
- Ce n'est pas un gestionnaire d'état : pour un état global fréquemment modifié → **Zustand**, Redux Toolkit, Jotai.

## useMemo et useCallback

```tsx
const visibles = useMemo(() => filtrer(todos, filtre), [todos, filtre]);
const handleClick = useCallback((id: string) => supprimer(id), [supprimer]);
```

- `useMemo` mémorise une **valeur**, `useCallback` une **fonction** (`useCallback(fn, deps)` = `useMemo(() => fn, deps)`).
- Utile pour : calcul vraiment coûteux, valeur passée à un enfant `memo`, dépendance d'un autre hook.
- Inutile partout ailleurs (ça a un coût). Le **React Compiler** (v1.0) mémoïse automatiquement et rend la plupart de ces appels superflus.

## Custom hooks

```tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

- Un custom hook est une fonction commençant par `use` qui appelle d'autres hooks.
- Il partage de la **logique**, pas de l'**état** : chaque composant qui l'appelle a son propre état.

## useSyncExternalStore

Pour s'abonner proprement à un store externe (store maison, API navigateur) sans *tearing* en rendu concurrent :

```tsx
const enLigne = useSyncExternalStore(
  (cb) => { addEventListener('online', cb); addEventListener('offline', cb); return () => { removeEventListener('online', cb); removeEventListener('offline', cb); }; },
  () => navigator.onLine,
);
```

## Autres hooks utiles

`useId` (ids uniques stables, SSR-compatibles, pour `htmlFor`/`aria-*`), `useTransition` (marquer une mise à jour comme non urgente), `useDeferredValue` (différer l'affichage d'une valeur), `useImperativeHandle`.

## S'entraîner

La doc React propose, en bas de chaque page, des défis avec solution et un bac à sable pour coder directement dans le navigateur :

- [Référencer des valeurs avec les refs](https://fr.react.dev/learn/referencing-values-with-refs#challenges) — 4 défis
- [Extraire la logique d’état dans un réducteur](https://fr.react.dev/learn/extracting-state-logic-into-a-reducer#challenges) — 4 défis
- [Transmettre des données en profondeur avec le contexte](https://fr.react.dev/learn/passing-data-deeply-with-context#challenges) — 1 défi
- [Réutiliser de la logique grâce aux Hooks personnalisés](https://fr.react.dev/learn/reusing-logic-with-custom-hooks#challenges) — 5 défis

<!-- QUIZ -->

### Pourquoi ce code enfreint-il les règles des hooks ?
```tsx
function Profil({ userId }: { userId?: string }) {
  if (!userId) return null;
  const [user, setUser] = useState<User | null>(null);
}
```
- [ ] `useState` ne peut pas être typé
- [x] Le hook est appelé après un `return` conditionnel : le nombre de hooks appelés varie d'un rendu à l'autre
- [ ] Il faut déclarer `user` avec `let`
- [ ] Aucun problème
> React associe les hooks à leur ordre d'appel. Tous les hooks doivent être appelés à chaque rendu, dans le même ordre : déplacer le `useState` avant le `return`.
[doc]: React — Règles des hooks | https://fr.react.dev/reference/rules/rules-of-hooks

### Modifier `ref.current` déclenche-t-il un nouveau rendu ?
- [ ] Oui, comme `setState`
- [x] Non : une ref est une boîte mutable dont React ne surveille pas les changements
- [ ] Oui, mais seulement en développement
- [ ] Seulement si la ref pointe vers un élément DOM
> C'est la différence fondamentale avec l'état. Une ref convient pour ce qui n'affecte pas l'affichage (id de timer, instance de lib, valeur précédente).
[doc]: React — Référencer des valeurs avec les refs | https://fr.react.dev/learn/referencing-values-with-refs

### Quel est l'intérêt principal de `useReducer` par rapport à plusieurs `useState` ?
- [ ] Il est plus rapide
- [x] Centraliser la logique de transition dans une fonction pure et testable, avec des actions explicites (et typables par union discriminée)
- [ ] Il évite tous les rendus
- [ ] Il remplace Redux côté serveur
> Le reducer décrit *comment* l'état change en réponse à *quoi*. Pratique quand plusieurs valeurs évoluent ensemble ou que les transitions sont nombreuses. `dispatch` a une identité stable.
[doc]: React — Extraire la logique d'état dans un réducteur | https://fr.react.dev/learn/extracting-state-logic-into-a-reducer

### Pourquoi tous les consommateurs re-rendent-ils à chaque rendu de `App` ?
```tsx
function App() {
  const [user, setUser] = useState<User | null>(null);
  return <AuthContext value={{ user, setUser }}><Page /></AuthContext>;
}
```
- [ ] Le contexte re-rend toujours tout l'arbre
- [x] `{ user, setUser }` est un nouvel objet à chaque rendu : la `value` change toujours selon `Object.is`
- [ ] `setUser` n'est pas stable
- [ ] Il faut `useContext` au lieu de `use`
> Mémoïser la valeur : `const value = useMemo(() => ({ user, setUser }), [user])`, ou séparer état et actions dans deux contextes. Le React Compiler fait cette mémoïsation automatiquement.
[doc]: React — Optimiser les rendus avec le contexte | https://fr.react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions

### Deux composants appellent le même custom hook `useCompteur()`. Partagent-ils le même état ?
- [ ] Oui, comme un singleton
- [x] Non : chaque appel crée un état indépendant ; un custom hook partage de la logique, pas de l'état
- [ ] Oui, si le hook est exporté
- [ ] Seulement s'ils sont frères
> Pour partager de l'état, il faut le remonter, utiliser un contexte ou un store externe.
[doc]: React — Réutiliser la logique avec des Hooks personnalisés | https://fr.react.dev/learn/reusing-logic-with-custom-hooks

### Quelle est la différence entre `useMemo` et `useCallback` ?
- [ ] `useCallback` est asynchrone
- [x] `useMemo` mémorise le **résultat** d'une fonction ; `useCallback` mémorise la **fonction** elle-même
- [ ] `useMemo` ne fonctionne qu'avec des tableaux
- [ ] Aucune
> `useCallback(fn, deps)` équivaut à `useMemo(() => fn, deps)`. Les deux ne servent que si l'identité stable a un effet (enfant `memo`, dépendance d'un effet) ou si le calcul est coûteux.
[doc]: React — useCallback | https://fr.react.dev/reference/react/useCallback

### Quand `useMemo` apporte-t-il réellement un gain ?
- [ ] Toujours, il faut l'utiliser partout
- [x] Pour un calcul coûteux mesuré, ou pour stabiliser une valeur passée à un composant `memo` ou utilisée comme dépendance d'un effet
- [ ] Pour mémoriser une chaîne simple
- [ ] Pour éviter le premier rendu
> La mémoïsation a un coût (mémoire, comparaison des dépendances, lisibilité). Mesurer d'abord avec le Profiler. Le React Compiler rend la plupart des `useMemo`/`useCallback` manuels inutiles.
[doc]: React — useMemo, faut-il l'ajouter partout ? | https://fr.react.dev/reference/react/useMemo#should-you-add-usememo-everywhere

### À quoi sert le React Compiler ?
- [ ] À compiler React en WebAssembly
- [x] À mémoïser automatiquement composants et valeurs au build, rendant superflus la plupart des `memo`, `useMemo` et `useCallback`
- [ ] À remplacer TypeScript
- [ ] À générer des composants serveur
> Plugin Babel (ou intégré aux frameworks) qui analyse le code et insère la mémoïsation. Il suppose que le code respecte les règles de React (pureté, immutabilité).
[doc]: React — React Compiler | https://fr.react.dev/learn/react-compiler

### Pourquoi le contexte n'est-il pas idéal pour un état global modifié très souvent (ex. position de la souris, panier mis à jour en continu) ?
- [ ] Le contexte ne supporte pas les objets
- [x] Chaque changement de `value` re-rend **tous** les consommateurs, sans sélection fine
- [ ] Le contexte est synchrone
- [ ] Le contexte ne fonctionne pas avec TypeScript
> Des stores comme Zustand, Redux Toolkit ou Jotai permettent de s'abonner à une **partie** de l'état (sélecteurs) : seuls les composants concernés re-rendent.
[doc]: React — Avant d'utiliser le contexte | https://fr.react.dev/learn/passing-data-deeply-with-context#before-you-use-context

### Quel hook permet de générer un identifiant unique et stable pour lier un `<label>` à un `<input>`, compatible SSR ?
- [ ] `useRef(Math.random())`
- [x] `useId()`
- [ ] `useMemo(() => crypto.randomUUID(), [])`
- [ ] `useState(Date.now())`
> `useId` produit le même id côté serveur et client (pas de *hydration mismatch*). Ne pas l'utiliser pour des `key` de liste.
[doc]: React — useId | https://fr.react.dev/reference/react/useId

### Quel hook utiliser pour s'abonner à un store externe (non React) de façon compatible avec le rendu concurrent ?
- [ ] `useEffect` + `useState`
- [x] `useSyncExternalStore`
- [ ] `useReducer`
- [ ] `useLayoutEffect`
> `useSyncExternalStore(subscribe, getSnapshot)` évite le *tearing* (deux parties de l'UI affichant des versions différentes du store). C'est ce qu'utilisent Redux et Zustand en interne.
[doc]: React — useSyncExternalStore | https://fr.react.dev/reference/react/useSyncExternalStore

### À quoi sert `useTransition` ?
- [ ] À animer les transitions CSS
- [x] À marquer une mise à jour d'état comme non urgente, pour que l'interface reste réactive (ex. saisie fluide pendant le filtrage d'une grosse liste)
- [ ] À changer de route
- [ ] À retarder un effet
> `const [isPending, startTransition] = useTransition()`. React peut interrompre le rendu de la transition si une mise à jour urgente (frappe clavier) arrive. En React 19, `startTransition` accepte des fonctions async (Actions).
[doc]: React — useTransition | https://fr.react.dev/reference/react/useTransition

### Quels usages de `useRef` sont appropriés ? (plusieurs réponses)
- [x] Obtenir un élément DOM pour appeler `focus()`
- [x] Stocker l'id d'un `setInterval` pour pouvoir l'annuler
- [ ] Stocker une valeur affichée à l'écran qui doit se mettre à jour
- [x] Garder l'instance d'une librairie tierce (carte, éditeur)
> Une valeur affichée doit être dans l'état : modifier une ref ne met pas l'écran à jour.
[doc]: React — useRef | https://fr.react.dev/reference/react/useRef

### Que reçoit un composant qui appelle `useContext(ThemeContext)` sans aucun `Provider` au-dessus de lui ?
- [ ] Une erreur
- [x] La valeur par défaut passée à `createContext(valeurParDefaut)`
- [ ] `undefined`, toujours
- [ ] La valeur du dernier Provider rendu ailleurs
> La valeur par défaut ne sert que s'il n'y a **aucun** fournisseur dans les ancêtres. C'est pour cela qu'on choisit souvent `null` comme défaut et qu'on lève une erreur explicite dans un hook `useTheme()`.
[doc]: React — createContext | https://fr.react.dev/reference/react/createContext

### En React 19, comment fournir une valeur de contexte ?
- [ ] Uniquement avec `<ThemeContext.Provider value="dark">`
- [x] `<ThemeContext value="dark">` fonctionne directement
- [ ] `<Provider context={ThemeContext} value="dark">`
- [ ] Avec `useContext(ThemeContext, 'dark')`
> React 19 permet d'utiliser le contexte lui-même comme fournisseur. `Context.Provider` fonctionne toujours mais sera déprécié à terme.
[doc]: React 19 — Context comme fournisseur | https://fr.react.dev/blog/2024/12/05/react-19#context-as-a-provider

### Pourquoi séparer l'état et `dispatch` dans deux contextes distincts ?
- [ ] Parce qu'un contexte ne peut contenir qu'une valeur
- [x] Pour que les composants qui ne font que déclencher des actions ne re-rendent pas à chaque changement d'état
- [ ] Parce que `dispatch` change à chaque rendu
- [ ] Pour pouvoir utiliser `useReducer`
> `dispatch` a une identité **stable** : un contexte qui ne contient que lui ne change jamais. Les boutons d'action le consomment sans être affectés par les mises à jour de l'état, consommé seulement par ceux qui l'affichent.
[doc]: React — Mise à l'échelle avec un réducteur et un contexte | https://fr.react.dev/learn/scaling-up-with-reducer-and-context

### Pourquoi un custom hook doit-il commencer par `use` ?
- [ ] C'est obligatoire pour que JavaScript l'exécute
- [x] Pour que React et le linter sachent qu'il appelle des hooks et appliquent les règles des hooks
- [ ] Pour qu'il soit mis en cache automatiquement
- [ ] Ce n'est qu'une convention sans conséquence
> La convention permet au linter `eslint-plugin-react-hooks` (et au React Compiler) de vérifier les appels conditionnels et les dépendances. Une fonction utilitaire qui n'appelle aucun hook ne doit **pas** commencer par `use`.
[doc]: React — Les noms des hooks commencent par use | https://fr.react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use

### À quoi sert `useDeferredValue(recherche)` ?
- [ ] À retarder un appel réseau de 300 ms (debounce)
- [x] À rendre une partie de l'UI avec une version « en retard » de la valeur, pour garder la saisie réactive
- [ ] À mémoriser une valeur entre deux rendus
- [ ] À différer l'exécution d'un effet
> React rend d'abord avec l'ancienne valeur, puis tente en arrière-plan un rendu avec la nouvelle, interruptible si l'utilisateur continue de taper. Ce n'est pas un debounce : aucun délai fixe, et cela n'économise pas d'appels réseau.
[doc]: React — useDeferredValue | https://fr.react.dev/reference/react/useDeferredValue

### À quoi sert `useImperativeHandle` ?
- [ ] À exécuter un effet avant l'affichage
- [x] À personnaliser ce qu'un composant expose via sa `ref` (ex. seulement `focus()` et `scrollIntoView()`)
- [ ] À forcer un nouveau rendu
- [ ] À créer un contexte impératif
> Au lieu d'exposer le nœud DOM entier, le composant publie une API restreinte. À réserver aux comportements impossibles à exprimer avec des props (focus, scroll, animation).
[doc]: React — useImperativeHandle | https://fr.react.dev/reference/react/useImperativeHandle

### Quelle nouveauté React 19 apporte-t-il aux *ref callbacks* ?
- [ ] Ils sont supprimés au profit de `useRef`
- [x] Ils peuvent retourner une fonction de nettoyage, appelée quand l'élément est retiré
- [ ] Ils sont appelés à chaque rendu
- [ ] Ils reçoivent le composant parent en argument
> `<div ref={(node) => { const obs = observe(node); return () => obs.disconnect(); }}>` : on peut brancher un `ResizeObserver` ou un `IntersectionObserver` sur un élément de liste sans effet séparé.
[doc]: React — Callback ref | https://fr.react.dev/reference/react-dom/components/common#ref-callback

### Quelle règle doit respecter la fonction passée à `useReducer` ?
- [ ] Elle doit être `async`
- [x] Elle doit être pure : calculer le nouvel état à partir de `(state, action)`, sans effet de bord ni mutation
- [ ] Elle doit appeler `dispatch` à la fin
- [ ] Elle doit retourner `undefined` pour les actions inconnues
> En StrictMode, React appelle le reducer deux fois pour révéler les impuretés. Les appels réseau ou les `localStorage.setItem` se font dans les gestionnaires d'événements ou les effets. Pour une action inconnue, on retourne l'état inchangé ou on lève une erreur.
[doc]: React — useReducer | https://fr.react.dev/reference/react/useReducer
