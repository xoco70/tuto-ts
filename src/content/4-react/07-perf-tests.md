---
id: react-perf-tests
track: react
order: 7
title: Performance, tests et architecture front
level: Senior
summary: Comprendre les re-rendus, memo, virtualisation, code splitting, Web Vitals, tests avec Testing Library et MSW, accessibilité, gestion d'état et structure d'une app.
---

## Pourquoi un composant re-rend

Un composant re-rend quand :
1. son **état** change ;
2. son **parent** re-rend (par défaut, **tous** les enfants re-rendent, même avec des props identiques) ;
3. un **contexte** qu'il consomme change.

Un re-rendu n'est pas forcément coûteux : React ne touche le DOM que si le résultat diffère. On n'optimise que ce qui est **mesuré** (React DevTools Profiler, « Highlight updates »).

## Les leviers

- **Déplacer l'état vers le bas** : l'état d'un input dans le composant de l'input, pas dans la page.
- **Passer du JSX en `children`** : un enfant passé en `children` n'est pas re-rendu quand le wrapper change d'état.
- **`memo(Composant)`** : saute le rendu si les props sont égales (`Object.is` prop par prop) → inutile si on lui passe un nouvel objet/fonction à chaque rendu.
- **Virtualisation** (`@tanstack/react-virtual`, `react-window`) : ne rendre que les lignes visibles d'une liste de 10 000 éléments.
- **Code splitting** : `const Admin = lazy(() => import('./Admin'))` + `<Suspense>`, par route.
- `useTransition` / `useDeferredValue` pour garder la saisie fluide.
- **React Compiler** : mémoïsation automatique.

## Web Vitals

- **LCP** (*Largest Contentful Paint*) : temps d'affichage du plus gros élément. ≤ 2,5 s.
- **INP** (*Interaction to Next Paint*) : réactivité aux interactions. ≤ 200 ms.
- **CLS** (*Cumulative Layout Shift*) : stabilité visuelle. ≤ 0,1.

Leviers front : réduire le JS (RSC, code splitting), images optimisées et dimensionnées, éviter les longues tâches sur le thread principal.

## Tester avec Testing Library

> « Plus vos tests ressemblent à la façon dont votre logiciel est utilisé, plus ils vous donnent confiance. »

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('ajoute un article au panier', async () => {
  const user = userEvent.setup();
  render(<Produit produit={produit} />);

  await user.click(screen.getByRole('button', { name: /ajouter au panier/i }));

  expect(await screen.findByText(/1 article/i)).toBeInTheDocument();
});
```

| Requête | Si absent | Asynchrone |
| --- | --- | --- |
| `getBy…` | lève une erreur | non |
| `queryBy…` | retourne `null` (pour tester l'**absence**) | non |
| `findBy…` | rejette après timeout | **oui** (attend l'apparition) |

Priorité des sélecteurs : `getByRole` (avec `name`) > `getByLabelText` > `getByPlaceholderText` > `getByText` > … > `getByTestId` en dernier recours.

- `userEvent` simule des interactions réalistes (focus, frappe, clavier) ; préférable à `fireEvent`.
- **MSW** intercepte les requêtes réseau au niveau du `fetch` : on teste les composants avec leur vrai code de chargement.
- Tester des **comportements**, pas des détails d'implémentation (état interne, nom de hooks).
- E2E avec **Playwright** pour les parcours critiques (inscription, paiement).

## Accessibilité (a11y)

- Utiliser les **éléments sémantiques** : `<button>` (pas un `<div onClick>`), `<a href>`, `<label>`, `<nav>`, `<main>`.
- Tout champ a un label, toute image informative un `alt`.
- Navigation clavier et focus visible ; gestion du focus dans les modales.
- `aria-*` en complément, pas en remplacement de la sémantique (« No ARIA is better than bad ARIA »).
- Bonus : des tests avec `getByRole` échouent quand l'accessibilité est mauvaise.

## Gestion d'état : quoi utiliser

| Besoin | Outil |
| --- | --- |
| État local | `useState` / `useReducer` |
| Données serveur | TanStack Query / RSC |
| État dans l'URL (filtres, pagination) | search params (partageable, survit au refresh) |
| Formulaires | React Hook Form + Zod, ou Actions React 19 |
| État global client | Zustand, Redux Toolkit, Jotai, ou contexte si peu changeant |

## Structure d'une application

Organiser **par fonctionnalité** (`features/orders/{components,hooks,api}`) plutôt que par type technique (`components/`, `hooks/` à la racine) dès que l'app grossit. Les composants UI génériques vont dans un design system partagé.

<!-- QUIZ -->

### Le composant `Parent` change d'état. Que deviennent ses enfants `<Enfant />` sans `memo`, aux props inchangées ?
- [ ] Ils ne re-rendent pas, les props n'ont pas changé
- [x] Ils re-rendent aussi : par défaut, le rendu d'un parent entraîne celui de tous ses enfants
- [ ] Ils sont démontés
- [ ] Seul le premier enfant re-rend
> React ne compare pas les props par défaut. Ce n'est en général pas un problème : le DOM n'est mis à jour que s'il y a une différence. `memo` permet de sauter le rendu quand c'est utile et mesuré.
[doc]: React — memo | https://fr.react.dev/reference/react/memo

### Pourquoi `memo` est-il inefficace ici ?
```tsx
const Ligne = memo(LigneImpl);
<Ligne item={item} onSelect={() => select(item.id)} style={{ padding: 4 }} />
```
- [ ] `memo` ne fonctionne qu'avec des classes
- [x] `onSelect` et `style` sont de nouvelles références à chaque rendu du parent : les props ne sont jamais égales
- [ ] `item` est un objet
- [ ] Il manque une `key`
> `memo` compare chaque prop avec `Object.is`. Il faut stabiliser les références (`useCallback`, `useMemo`, constantes hors du composant) — ou laisser le React Compiler le faire.
[doc]: React — Minimiser les changements de props | https://fr.react.dev/reference/react/memo#minimizing-props-changes

### Une liste de 20 000 lignes rend la page lente. Quelle solution est la plus adaptée ?
- [ ] Ajouter `memo` sur chaque ligne
- [x] La virtualisation : ne rendre que les lignes visibles (`@tanstack/react-virtual`, `react-window`)
- [ ] Passer en composant classe
- [ ] Augmenter la mémoire du navigateur
> Même mémoïsées, 20 000 lignes créent 20 000 nœuds DOM. La virtualisation en rend quelques dizaines. Alternative : pagination côté serveur.
[doc]: TanStack Virtual (EN) | https://tanstack.com/virtual/latest

### Comment charger le code d'une page d'administration seulement quand on y accède ?
- [ ] `import Admin from './Admin'` en haut du fichier
- [x] `const Admin = lazy(() => import('./Admin'))` affiché dans un `<Suspense>`
- [ ] `useEffect(() => require('./Admin'))`
- [ ] Ce n'est pas possible avec React
> L'import dynamique crée un chunk séparé, téléchargé à la demande. Le découpage par route est le plus rentable.
[doc]: React — lazy | https://fr.react.dev/reference/react/lazy

### Quelle requête Testing Library utiliser pour vérifier qu'un message d'erreur n'est **pas** affiché ?
- [ ] `getByText`
- [x] `queryByText` (retourne `null` si absent)
- [ ] `findByText`
- [ ] `getByTestId`
> `getBy` lève une erreur si l'élément est absent, ce qui ferait échouer le test avant l'assertion. `expect(screen.queryByText(/erreur/i)).not.toBeInTheDocument()`.
[doc]: Testing Library — Types of queries (EN) | https://testing-library.com/docs/queries/about#types-of-queries

### Un texte apparaît après le chargement de données. Quelle requête utiliser ?
- [ ] `getByText` immédiatement après `render`
- [x] `await screen.findByText(...)`, qui attend son apparition
- [ ] `queryByText`
- [ ] `setTimeout` puis `getByText`
> `findBy*` combine `getBy*` et `waitFor` : il réessaie jusqu'au timeout (1 s par défaut). Les `setTimeout` arbitraires rendent les tests lents et instables.
[doc]: Testing Library — findBy queries (EN) | https://testing-library.com/docs/dom-testing-library/api-async#findby-queries

### Quel sélecteur Testing Library est à privilégier ?
- [ ] `getByTestId('submit')`
- [ ] `container.querySelector('.btn-primary')`
- [x] `getByRole('button', { name: /envoyer/i })`
- [ ] `getByClassName('btn')`
> `getByRole` interroge l'arbre d'accessibilité, comme un lecteur d'écran : le test reflète l'usage réel et vérifie au passage l'accessibilité. Les `data-testid` sont un dernier recours.
[doc]: Testing Library — Priority (EN) | https://testing-library.com/docs/queries/about#priority

### Pourquoi utiliser MSW dans les tests de composants qui chargent des données ?
- [ ] Pour accélérer le rendu
- [x] Il intercepte les requêtes réseau et renvoie des réponses simulées : le composant est testé avec son vrai code de fetch, sans mocker le module d'API
- [ ] Pour générer des snapshots
- [ ] Pour tester le backend
> Les mêmes handlers MSW servent aux tests, à Storybook et au développement local sans backend.
[doc]: MSW — Philosophy (EN) | https://mswjs.io/docs/philosophy

### Que mesure l'INP (Interaction to Next Paint) ?
- [ ] Le temps de chargement du plus gros élément
- [x] La réactivité : le délai entre une interaction (clic, frappe) et l'affichage suivant
- [ ] Les décalages de mise en page
- [ ] Le temps de réponse du serveur
> L'INP a remplacé le FID dans les Core Web Vitals en 2024 (seuil « bon » ≤ 200 ms). Les longues tâches JavaScript sur le thread principal le dégradent.
[doc]: web.dev — INP | https://web.dev/articles/inp?hl=fr

### Pourquoi `<div onClick={...}>Valider</div>` est-il un problème d'accessibilité ?
- [ ] Les div ne peuvent pas recevoir d'événements
- [x] Il n'est ni focusable au clavier, ni activable avec Entrée/Espace, ni annoncé comme bouton par les lecteurs d'écran
- [ ] React l'interdit
- [ ] Il est plus lent
> `<button>` fournit gratuitement focus, clavier, rôle et état désactivé. Recréer tout cela sur un `div` (tabIndex, role, gestion des touches) est fastidieux et souvent incomplet.
[doc]: MDN — Le rôle button | https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Reference/Roles/button_role

### Où stocker les filtres et la page courante d'une liste de commandes ?
- [ ] Dans un contexte global
- [ ] Dans `localStorage`
- [x] Dans l'URL (search params) : partageable, survit au rafraîchissement et au bouton retour
- [ ] Dans un `useRef`
> L'URL est un état global gratuit et partageable. Les routeurs (React Router, TanStack Router, Next.js) fournissent des hooks pour lire/écrire les search params.
[doc]: React Router — useSearchParams (EN) | https://reactrouter.com/api/hooks/useSearchParams

### Quelle technique évite que `<Contenu />` re-rende quand `Survol` change d'état ?
```tsx
function Survol({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return <div onMouseEnter={() => setHover(true)}>{children}</div>;
}
<Survol><Contenu /></Survol>
```
- [ ] Il faut obligatoirement `memo(Contenu)`
- [x] Aucune de plus : `Contenu` est créé par le parent de `Survol` et passé en `children`, il ne re-rend pas quand l'état de `Survol` change
- [ ] Déplacer `hover` dans un contexte
- [ ] Utiliser `useLayoutEffect`
> L'élément `children` est déjà créé : quand `Survol` re-rend, la référence de `children` est la même et React saute ce sous-arbre. C'est le pattern de composition « lifting content up ».
[doc]: React — memo, alternatives (composition) | https://fr.react.dev/reference/react/memo#minimizing-props-changes

### Quelles pratiques améliorent la qualité des tests de composants React ? (plusieurs réponses)
- [x] Interagir avec `userEvent` plutôt que d'appeler des fonctions internes
- [x] Sélectionner les éléments par rôle et nom accessible
- [ ] Vérifier la valeur de l'état interne du composant
- [x] Simuler le réseau avec MSW
> Tester l'état interne lie le test à l'implémentation : un refactoring (useState → useReducer) le casserait sans changer le comportement.
[doc]: Testing Library — Guiding principles (EN) | https://testing-library.com/docs/guiding-principles

### Quel outil utiliser en premier pour savoir quels composants re-rendent et combien de temps cela prend ?
- [ ] Ajouter `memo` partout puis comparer
- [x] Le Profiler des React DevTools
- [ ] `console.time` dans chaque composant
- [ ] Lighthouse
> On **mesure** avant d'optimiser. Le Profiler montre chaque commit, les composants rendus, leur durée et la raison du rendu (« why did this render »). Lighthouse évalue la page globale, pas les rendus React.
[doc]: React — Profiler | https://fr.react.dev/reference/react/Profiler

### Pourquoi préférer `userEvent` à `fireEvent` dans Testing Library ?
- [ ] `fireEvent` est déprécié
- [x] `userEvent` simule une interaction complète (focus, keydown, input, keyup, click…) comme un vrai utilisateur
- [ ] `userEvent` est synchrone, donc plus simple
- [ ] `fireEvent` ne fonctionne pas avec React
> `fireEvent.change` envoie un seul événement ; `await user.type(input, 'bonjour')` déclenche toute la séquence clavier, ce qui révèle des bugs (handlers `onKeyDown`, champs désactivés). Les méthodes de `userEvent` sont asynchrones : pensez à `await`.
[doc]: Testing Library — user-event (EN) | https://testing-library.com/docs/user-event/intro

### Quelle métrique Core Web Vitals mesure le temps d'affichage du plus grand élément visible (image principale, titre) ?
- [ ] INP
- [ ] CLS
- [x] LCP
- [ ] TTFB
> Le **Largest Contentful Paint** devrait être inférieur à 2,5 s. Leviers : temps de réponse serveur, image principale préchargée et non lazy-loadée, SSR plutôt qu'un écran blanc qui attend le JS.
[doc]: web.dev — LCP | https://web.dev/articles/lcp?hl=fr

### Quelle est la cause la plus fréquente d'un mauvais score CLS (Cumulative Layout Shift) ?
- [ ] Un bundle JS trop gros
- [x] Des images, publicités ou contenus chargés sans espace réservé, qui poussent le reste de la page
- [ ] Trop de re-rendus React
- [ ] Une API lente
> On réserve l'espace avec `width`/`height` (ou `aspect-ratio`) sur les images, des skeletons de taille fixe, et on évite d'insérer du contenu au-dessus de ce que l'utilisateur lit.
[doc]: web.dev — CLS | https://web.dev/articles/cls?hl=fr

### Un test affiche le warning « An update to X inside a test was not wrapped in act(...) ». Que signifie-t-il le plus souvent ?
- [ ] Qu'il faut envelopper chaque ligne du test dans `act`
- [x] Qu'une mise à jour d'état asynchrone survient après la fin des assertions : il faut l'attendre (`findBy…`, `waitFor`)
- [ ] Que le composant a une fuite mémoire
- [ ] Que React n'est pas installé en mode test
> Testing Library enveloppe déjà `render` et les événements dans `act`. Le warning révèle presque toujours un effet ou une requête qui se termine après le test : attendre l'état final rend le test fidèle et fait disparaître le message.
[doc]: React — act | https://fr.react.dev/reference/react/act

### Quel est le principal défaut des tests par snapshot de gros composants ?
- [ ] Ils sont lents
- [x] Ils cassent à chaque changement de rendu et finissent mis à jour sans relecture : ils ne vérifient plus rien
- [ ] Ils ne fonctionnent pas avec TypeScript
- [ ] Ils nécessitent un navigateur réel
> Un snapshot de 300 lignes ne dit pas ce qui compte. Réservez-les à des sorties petites et stables (un sérialiseur, un message d'erreur) et préférez des assertions explicites sur ce que voit l'utilisateur.
[doc]: Jest — Snapshot testing (EN) | https://jestjs.io/docs/snapshot-testing

### Quel rôle donner aux tests end-to-end (Playwright, Cypress) ?
- [ ] Couvrir chaque cas limite de chaque formulaire
- [x] Vérifier quelques parcours critiques (connexion, paiement) dans un vrai navigateur, contre une application déployée
- [ ] Remplacer les tests d'intégration
- [ ] Mesurer la couverture de code
> Les tests e2e donnent la plus grande confiance mais sont lents et plus fragiles. On les garde peu nombreux et ciblés ; les variantes se testent plus bas (composants, API).
[doc]: Playwright — Introduction (EN) | https://playwright.dev/docs/intro

### Comment faire annoncer par un lecteur d'écran un message « Commande enregistrée » apparu après une action ?
- [ ] Avec `alert()`
- [x] Avec une zone `aria-live="polite"` (ou `role="status"`) présente dans le DOM dans laquelle on insère le message
- [ ] Avec `tabIndex={0}` sur le message
- [ ] Avec une couleur verte contrastée
> Les lecteurs d'écran ne lisent pas automatiquement le contenu qui apparaît. Une région live, montée **avant** que le message n'y soit inséré, annonce les changements sans déplacer le focus. `role="alert"` est réservé aux messages urgents.
[doc]: MDN — aria-live | https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live

### Que distingue-t-on entre « données de laboratoire » et « données terrain » en performance web ?
- [ ] Rien, ce sont deux noms de Lighthouse
- [x] Le labo (Lighthouse) mesure dans un environnement contrôlé ; le terrain (CrUX, RUM) mesure les vrais utilisateurs, appareils et réseaux
- [ ] Le terrain ne concerne que les applications mobiles
- [ ] Le labo est toujours plus pessimiste
> Lighthouse est idéal pour déboguer et comparer, mais Google classe sur les données terrain. Un site rapide sur un MacBook peut avoir un INP médiocre sur des téléphones d'entrée de gamme.
[doc]: web.dev — Données de laboratoire et données terrain | https://web.dev/articles/lab-and-field-data-differences?hl=fr
