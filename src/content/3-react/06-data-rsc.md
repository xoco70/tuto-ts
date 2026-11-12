---
id: react-data
track: react
order: 6
title: Données, Suspense, React 19 et Server Components
level: Avancé
summary: TanStack Query, Suspense et error boundaries, Actions de React 19 (useActionState, useOptimistic, use), Server Components et Next.js App Router.
---

## État serveur ≠ état client

- **État client** : UI locale (modale ouverte, onglet, saisie). → `useState`, Zustand…
- **État serveur** : données dont la source de vérité est le backend (utilisateurs, commandes). Elles sont **asynchrones, partagées, et peuvent être périmées**. → cache dédié : **TanStack Query**, SWR, ou chargement côté serveur.

## TanStack Query

```tsx
const { data, isPending, isError, error } = useQuery({
  queryKey: ['orders', { status }],             // clé de cache, sérialisable
  queryFn: () => api.getOrders({ status }),
  staleTime: 60_000,                            // fraîche pendant 1 min
});

const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: api.createOrder,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
});
```

- `staleTime` (défaut **0**) : durée pendant laquelle les données sont considérées fraîches (pas de refetch).
- `gcTime` (défaut **5 min**) : durée de conservation en cache d'une requête **inutilisée**.
- Refetch automatique au focus de la fenêtre, à la reconnexion, au montage (si périmée).
- Déduplication : deux composants avec la même `queryKey` = une seule requête.
- **Mise à jour optimiste** : `onMutate` modifie le cache, `onError` restaure, `onSettled` invalide.

## Suspense et error boundaries

```tsx
<ErrorBoundary fallback={<Erreur />}>
  <Suspense fallback={<Squelette />}>
    <ListeCommandes />            {/* useSuspenseQuery(...) ou use(promise) */}
  </Suspense>
</ErrorBoundary>
```

- **Suspense** affiche un fallback pendant qu'un composant enfant « attend » (code lazy, données compatibles Suspense).
- Une **error boundary** attrape les erreurs de **rendu** de ses enfants. Elle s'écrit encore en **composant classe** (`getDerivedStateFromError`) ou avec `react-error-boundary`. Elle n'attrape **pas** les erreurs des gestionnaires d'événements ni du code asynchrone hors rendu.

## React 19 : Actions

```tsx
async function enregistrer(prev: State, formData: FormData): Promise<State> {
  const res = await api.save(formData.get('nom'));
  return res.ok ? { ok: true } : { erreur: res.message };
}

function Formulaire() {
  const [state, formAction, isPending] = useActionState(enregistrer, { ok: false });
  return (
    <form action={formAction}>
      <input name="nom" />
      <button disabled={isPending}>Enregistrer</button>
      {state.erreur && <p>{state.erreur}</p>}
    </form>
  );
}
```

- `<form action={fn}>` : React appelle `fn(formData)` dans une transition, et réinitialise le formulaire après succès.
- `useActionState` : état retourné par l'action + `isPending`.
- `useFormStatus` (react-dom) : `pending` du formulaire parent, depuis un composant enfant (bouton).
- `useOptimistic` : afficher immédiatement le résultat attendu, annulé automatiquement si l'action échoue.
- `use(promise)` / `use(Context)` : lire une ressource ; contrairement aux hooks, `use` **peut** être appelé dans une condition.

## Server Components (RSC)

Dans Next.js App Router, les composants sont **serveur par défaut** :

```tsx
// app/orders/page.tsx — Server Component
export default async function Page() {
  const orders = await db.order.findMany();      // accès direct à la base, aucun JS envoyé
  return <OrdersTable orders={orders} />;
}
```

```tsx
'use client';                                     // frontière : ce module et ses imports vont au navigateur
export function FiltreStatut() {
  const [statut, setStatut] = useState('all');
}
```

| Server Component | Client Component |
| --- | --- |
| `async`, accès DB/secrets | `useState`, `useEffect`, événements |
| zéro JS côté client | hydraté dans le navigateur |
| pas de hooks d'état ni d'API navigateur | pas d'accès direct au serveur |

- Un Server Component peut rendre un Client Component (props **sérialisables** uniquement : pas de fonctions, sauf Server Functions).
- Un Client Component ne peut pas **importer** un Server Component, mais peut le recevoir en `children`.
- `'use server'` marque des **Server Functions** (ex-Server Actions) appelables depuis le client : ce sont des **endpoints publics** → valider les entrées et vérifier l'autorisation **à chaque fois**.

## SSR, SSG, CSR

- **CSR** : HTML vide, tout en JS côté client (SPA Vite).
- **SSR** : HTML généré à chaque requête, puis **hydratation**.
- **SSG / ISR** : HTML généré au build (ou régénéré périodiquement).
- **Streaming** : le serveur envoie le HTML par morceaux au fil des `<Suspense>`.

Une **erreur d'hydratation** survient quand le HTML serveur diffère du premier rendu client (`Date.now()`, `Math.random()`, `window` lu pendant le rendu).

<!-- QUIZ -->

### Quelle est la différence entre `staleTime` et `gcTime` dans TanStack Query ?
- [ ] Ce sont des synonymes
- [x] `staleTime` : durée pendant laquelle les données sont fraîches (pas de refetch) ; `gcTime` : durée de conservation en cache d'une requête qui n'a plus d'observateur
- [ ] `gcTime` contrôle le timeout HTTP
- [ ] `staleTime` supprime les données du cache
> Par défaut `staleTime = 0` (toujours périmé → refetch au montage, au focus…) et `gcTime = 5 min`. Augmenter `staleTime` pour les données qui changent peu.
[doc]: TanStack Query — Important defaults (EN) | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

### Après une mutation `createOrder`, comment rafraîchir la liste des commandes ?
- [ ] Recharger la page
- [x] `queryClient.invalidateQueries({ queryKey: ['orders'] })` dans `onSuccess`
- [ ] Appeler `useQuery` une seconde fois
- [ ] Mettre `staleTime: 0`
> L'invalidation marque les requêtes correspondantes comme périmées et refetch celles qui sont affichées. La correspondance est partielle : `['orders']` invalide aussi `['orders', { status: 'paid' }]`.
[doc]: TanStack Query — Invalidations from mutations (EN) | https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

### Pourquoi l'état serveur ne devrait-il pas être géré comme l'état client (ex. tout dans Redux) ?
- [ ] Redux ne supporte pas les tableaux
- [x] Il est asynchrone, partagé, peut devenir périmé et nécessite cache, déduplication, revalidation : ce sont les responsabilités d'une librairie dédiée
- [ ] Il est toujours plus petit
- [ ] Il ne peut pas être typé
> Mettre l'état serveur dans un store générique oblige à réécrire à la main loading, erreurs, cache et invalidation. TanStack Query (ou RTK Query) les gère nativement.
[doc]: TanStack Query — Overview (EN) | https://tanstack.com/query/latest/docs/framework/react/overview

### Quelle erreur une error boundary n'attrape-t-elle pas ?
- [ ] Une erreur levée pendant le rendu d'un enfant
- [x] Une erreur levée dans un gestionnaire `onClick`
- [ ] Une erreur levée par un enfant qui utilise `use(promise)` avec une promesse rejetée
- [ ] Une erreur d'un composant petit-enfant pendant son rendu
> Les error boundaries attrapent les erreurs de rendu (et des promesses lues pendant le rendu). Les erreurs des gestionnaires d'événements et du code asynchrone hors rendu se gèrent avec `try/catch` et un état d'erreur.
[doc]: React — Capturer les erreurs de rendu avec un périmètre d'erreur | https://fr.react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

### Que fait `useOptimistic` ?
- [ ] Il met en cache la réponse
- [x] Il affiche immédiatement une valeur supposée pendant qu'une action asynchrone est en cours, puis revient à l'état réel à la fin (succès ou échec)
- [ ] Il réessaie automatiquement les requêtes
- [ ] Il précharge les données
> Exemple : un message apparaît tout de suite avec un statut « envoi… ». Si l'action échoue, la valeur optimiste disparaît automatiquement.
[doc]: React — useOptimistic | https://fr.react.dev/reference/react/useOptimistic

### Que renvoie `useActionState(action, initialState)` ?
- [ ] Une promesse
- [x] `[state, formAction, isPending]` : le dernier état retourné par l'action, l'action à passer au formulaire, et un indicateur d'exécution
- [ ] Uniquement l'état
- [ ] Un `FormData`
> L'action reçoit `(previousState, formData)` et retourne le nouvel état (succès, erreurs de validation…). Fonctionne avec ou sans Server Functions.
[doc]: React — useActionState | https://fr.react.dev/reference/react/useActionState

### Quelle particularité a `use` par rapport aux autres hooks ?
- [ ] Il ne peut être utilisé que côté serveur
- [x] Il peut être appelé dans une condition ou une boucle
- [ ] Il ne fonctionne qu'avec des contextes
- [ ] Il remplace `useEffect`
> `use(promise)` suspend le composant jusqu'à la résolution ; `use(Context)` lit un contexte. Il doit toujours être appelé pendant le rendu (pas dans un handler). Attention : la promesse ne doit pas être recréée à chaque rendu.
[doc]: React — use | https://fr.react.dev/reference/react/use

### Que signifie la directive `'use client'` en tête d'un fichier Next.js App Router ?
- [ ] Le composant ne fait jamais de SSR
- [x] Elle marque une frontière : ce module et tout ce qu'il importe font partie du bundle client et sont hydratés (le composant est quand même pré-rendu en HTML au serveur)
- [ ] Elle désactive TypeScript
- [ ] Elle rend le composant asynchrone
> Les Client Components sont aussi rendus côté serveur au premier chargement (SSR), puis hydratés. `'use client'` sert à pouvoir utiliser état, effets et API navigateur.
[doc]: React — 'use client' | https://fr.react.dev/reference/rsc/use-client

### Pourquoi ce code échoue-t-il dans un Server Component ?
```tsx
export default async function Page() {
  const [filtre, setFiltre] = useState('');
  const data = await db.query();
}
```
- [ ] `await` est interdit dans un composant
- [x] Les Server Components n'ont pas d'état ni d'effets : `useState` exige un Client Component
- [ ] `db` n'est pas accessible côté serveur
- [ ] Il manque une `key`
> Un Server Component est exécuté une fois côté serveur, sans interactivité. On extrait la partie interactive dans un Client Component (`'use client'`) et on lui passe les données en props.
[doc]: React — Server Components | https://fr.react.dev/reference/rsc/server-components

### Quel est le risque principal d'une Server Function (`'use server'`) comme `deleteOrder(id)` ?
- [ ] Elle s'exécute dans le navigateur
- [x] C'est un endpoint HTTP public : n'importe qui peut l'appeler avec n'importe quel argument, il faut valider les entrées et vérifier l'authentification / l'autorisation dans la fonction
- [ ] Elle ne peut pas accéder à la base
- [ ] Elle est appelée à chaque rendu
> L'appel ressemble à une fonction locale, mais c'est une requête POST. Les mêmes règles que pour un controller NestJS s'appliquent (IDOR, validation, rate limiting).
[doc]: React — 'use server', considérations de sécurité | https://fr.react.dev/reference/rsc/use-server#security

### Qu'est-ce qui provoque une erreur d'hydratation ?
- [ ] Un composant trop gros
- [x] Un rendu client initial différent du HTML produit par le serveur (ex. `Date.now()`, `Math.random()`, `typeof window` lu pendant le rendu)
- [ ] L'utilisation de TypeScript
- [ ] Un appel `fetch` dans un handler
> L'hydratation suppose que le premier rendu client reproduit exactement le HTML serveur. Les valeurs dépendant du client se calculent dans un effet (après hydratation) ou avec `suppressHydrationWarning` pour des cas comme une date.
[doc]: React — hydrateRoot, erreurs d'hydratation | https://fr.react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content

### Un Client Component peut-il afficher un Server Component ?
- [ ] Oui, en l'important directement
- [x] Pas en l'important, mais oui s'il le reçoit en `children` (ou en prop JSX) depuis un Server Component parent
- [ ] Non, jamais
- [ ] Oui, avec `dynamic()`
> Importer un module dans un fichier `'use client'` le fait passer côté client. Passer le Server Component déjà rendu en `children` préserve son exécution serveur.
[doc]: Next.js — Interleaving Server and Client Components (EN) | https://nextjs.org/docs/app/getting-started/server-and-client-components#interleaving-server-and-client-components

### Quelle stratégie de rendu génère le HTML au moment du build ?
- [ ] CSR
- [ ] SSR
- [x] SSG (génération statique)
- [ ] Streaming
> SSG/ISR conviennent aux pages identiques pour tous (blog, marketing). SSR pour du contenu personnalisé ou très dynamique. CSR pour des applications derrière login où le SEO importe peu.
[doc]: Next.js — Rendering (EN) | https://nextjs.org/docs/app/getting-started/partial-prerendering

### Quelles fonctionnalités TanStack Query fournit-il par défaut ? (plusieurs réponses)
- [x] Déduplication des requêtes identiques
- [x] Refetch quand la fenêtre reprend le focus
- [x] Retries automatiques en cas d'échec (3 par défaut côté client)
- [ ] Validation du schéma des réponses
> TanStack Query ne valide pas les données : il faut le faire dans la `queryFn` (Zod) si la réponse n'est pas garantie.
[doc]: TanStack Query — Important defaults (EN) | https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
