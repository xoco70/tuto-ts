---
id: react-typescript
track: react
order: 5
title: React avec TypeScript
level: Intermédiaire
summary: Typer props, children, événements, refs, état, contexte, composants génériques, props discriminées et polymorphes.
---

## Props

```tsx
interface BoutonProps {
  variante?: 'primaire' | 'secondaire';
  onClick: () => void;
  children: React.ReactNode;
}

function Bouton({ variante = 'primaire', onClick, children }: BoutonProps) {
  return <button className={variante} onClick={onClick}>{children}</button>;
}
```

- Typer la signature directement plutôt qu'utiliser `React.FC` (qui n'apporte plus grand-chose depuis React 18 et a longtemps ajouté `children` implicitement).
- `React.ReactNode` : tout ce qui peut être rendu (élément, chaîne, nombre, `null`, tableau…). `React.ReactElement` / `JSX.Element` : uniquement un élément JSX.

## Étendre les props d'un élément natif

```tsx
type InputProps = React.ComponentProps<'input'> & { label: string };

function Champ({ label, ...rest }: InputProps) {
  const id = useId();
  return <><label htmlFor={id}>{label}</label><input id={id} {...rest} /></>;
}

type BoutonNatif = React.ComponentPropsWithoutRef<'button'>;
type PropsDeBouton = React.ComponentProps<typeof Bouton>;  // props d'un composant existant
```

## Événements

```tsx
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValeur(e.target.value);
const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); };
const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {};
const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') {} };
```

Astuce : écrire le handler inline une fois et survoler `e` dans l'éditeur pour obtenir le type exact.

## État

```tsx
const [user, setUser] = useState<User | null>(null);   // annoter quand l'initial ne suffit pas
const [items, setItems] = useState<Item[]>([]);        // [] seul serait never[]
const [count, setCount] = useState(0);                 // inféré : number
```

## Refs

```tsx
const inputRef = useRef<HTMLInputElement>(null);   // RefObject<HTMLInputElement | null>
const timerRef = useRef<number | undefined>(undefined);
```

### `ref` comme prop (React 19)

```tsx
function Champ({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />;
}
```

Depuis React 19, `ref` est une prop ordinaire pour les composants fonction : `forwardRef` n'est plus nécessaire (et sera déprécié).

## Props discriminées

```tsx
type AlerteProps =
  | { type: 'lien'; href: string }
  | { type: 'bouton'; onClick: () => void };

function Action(props: AlerteProps) {
  return props.type === 'lien' ? <a href={props.href}>Voir</a> : <button onClick={props.onClick}>Voir</button>;
}
<Action type="lien" onClick={() => {}} />   // ❌ erreur : onClick n'existe pas pour type="lien"
```

## Composants génériques

```tsx
interface ListeProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}

function Liste<T>({ items, getKey, renderItem }: ListeProps<T>) {
  return <ul>{items.map((i) => <li key={getKey(i)}>{renderItem(i)}</li>)}</ul>;
}

<Liste items={users} getKey={(u) => u.id} renderItem={(u) => u.nom} />   // T inféré = User
```

Dans un fichier `.tsx`, une fonction fléchée générique s'écrit `<T,>(props: ListeProps<T>) => ...`.

## Contexte typé sans valeur par défaut factice

```tsx
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
```

## Custom hooks : retourner un tuple

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;    // sinon : (boolean | (() => void))[]
}
```

<!-- QUIZ -->

### Quel type utiliser pour une prop `children` qui accepte du texte, des éléments, `null` ou une liste ?
- [ ] `JSX.Element`
- [x] `React.ReactNode`
- [ ] `React.ReactElement`
- [ ] `string`
> `ReactNode` couvre tout ce que React sait rendre. `JSX.Element`/`ReactElement` n'acceptent qu'un élément JSX unique, ce qui refuserait une chaîne ou `null`.
[doc]: React — TypeScript, typer children | https://fr.react.dev/learn/typescript#typing-children

### Comment typer le paramètre d'un `onChange` sur un `<input>` ?
- [ ] `(e: Event) => void`
- [x] `(e: React.ChangeEvent<HTMLInputElement>) => void`
- [ ] `(e: InputEvent) => void`
- [ ] `(e: React.FormEvent<string>) => void`
> React utilise des événements synthétiques typés : `ChangeEvent`, `MouseEvent`, `FormEvent`, `KeyboardEvent`… paramétrés par l'élément. `e.target.value` est alors une `string`.
[doc]: React — TypeScript, typer les événements DOM | https://fr.react.dev/learn/typescript#typing-dom-events

### Quel est le type inféré de `items` ?
```tsx
const [items, setItems] = useState([]);
```
- [ ] `any[]`
- [x] `never[]`
- [ ] `unknown[]`
- [ ] `Item[]`
> Un tableau vide sans contexte est inféré `never[]` : impossible d'y ajouter quoi que ce soit. Il faut annoter : `useState<Item[]>([])`.
[doc]: React — TypeScript, useState | https://fr.react.dev/learn/typescript#typing-usestate

### Comment créer un composant `Champ` qui accepte toutes les props natives d'un `<input>` plus une prop `label` ?
- [ ] `interface Props extends HTMLInputElement { label: string }`
- [x] `type Props = React.ComponentProps<'input'> & { label: string }`
- [ ] `type Props = { label: string; [k: string]: any }`
- [ ] `type Props = InputHTMLAttributes`
> `ComponentProps<'input'>` donne exactement les props JSX d'un input (`value`, `onChange`, `disabled`, `aria-*`…). `HTMLInputElement` est le type de l'élément DOM, pas de ses props.
[doc]: React — TypeScript, props d'éléments DOM | https://fr.react.dev/learn/typescript#typing-dom-events

### En React 19, comment transmettre une `ref` à l'input interne d'un composant fonction ?
- [ ] C'est impossible sans `forwardRef`
- [x] Déclarer `ref` comme une prop ordinaire et la passer à l'`<input>`
- [ ] Utiliser `useImperativeHandle` obligatoirement
- [ ] Passer par un contexte
> React 19 traite `ref` comme une prop pour les composants fonction : `function Champ({ ref, ...p }: React.ComponentProps<'input'>)`. `forwardRef` reste supporté mais n'est plus nécessaire.
[doc]: Blog React 19 — ref as a prop (EN) | https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop

### Quel est l'avantage de ce typage de props ?
```tsx
type Props = { type: 'lien'; href: string } | { type: 'bouton'; onClick: () => void };
```
- [ ] Il rend toutes les props optionnelles
- [x] TypeScript empêche les combinaisons invalides (`href` sans `type: 'lien'`, `onClick` avec `type: 'lien'`)
- [ ] Il améliore les performances
- [ ] Il génère deux composants
> Une union discriminée de props rend les états impossibles non représentables, au lieu d'un objet avec `href?` et `onClick?` optionnels dont toutes les combinaisons sont acceptées.
[doc]: Handbook — Discriminated unions | https://www.typescriptlang.org/fr/docs/handbook/2/narrowing.html

### Pourquoi le hook retourne-t-il `[on, toggle] as const` ?
```tsx
function useToggle() {
  const [on, setOn] = useState(false);
  const toggle = () => setOn((v) => !v);
  return [on, toggle] as const;
}
```
- [ ] Pour rendre le tuple immuable au runtime
- [x] Sans `as const`, le retour est inféré `(boolean | (() => void))[]` et l'appelant perd le type de chaque position
- [ ] `as const` est obligatoire dans un hook
- [ ] Pour mémoïser le résultat
> `as const` fait inférer un tuple `readonly [boolean, () => void]`. Alternative : annoter le type de retour.
[doc]: Handbook — Tuples readonly | https://www.typescriptlang.org/fr/docs/handbook/2/objects.html

### Comment écrire un composant générique `Liste<T>` en fonction fléchée dans un fichier `.tsx` ?
- [ ] `const Liste = <T>(props: ListeProps<T>) => ...`
- [x] `const Liste = <T,>(props: ListeProps<T>) => ...`
- [ ] `const Liste<T> = (props) => ...`
- [ ] Les composants génériques doivent être des classes
> Dans un `.tsx`, `<T>` est lu comme une balise JSX. La virgule (`<T,>`) ou une contrainte (`<T extends object>`) lève l'ambiguïté. Avec `function Liste<T>(...)`, pas de problème.
[doc]: React TypeScript Cheatsheet — Generic components (EN) | https://react-typescript-cheatsheet.netlify.app/docs/advanced/patterns_by_usecase/#generic-components

### Quel est l'intérêt du hook `useAuth` qui lève une erreur si le contexte est `null` ?
```tsx
const AuthContext = createContext<AuthValue | null>(null);
```
- [ ] Il évite le rendu
- [x] Les consommateurs reçoivent un `AuthValue` non nullable, et une utilisation hors du provider échoue avec un message clair
- [ ] Il rend le contexte global
- [ ] C'est obligatoire avec `createContext`
> Évite de fournir une valeur par défaut factice (`{} as AuthValue`, un mensonge au compilateur) et les `!` partout dans les consommateurs.
[doc]: React — TypeScript, useContext | https://fr.react.dev/learn/typescript#typing-usecontext

### Comment récupérer le type des props d'un composant existant `Bouton` d'une librairie ?
- [ ] `typeof Bouton.props`
- [x] `React.ComponentProps<typeof Bouton>`
- [ ] `Parameters<Bouton>`
- [ ] `Props<Bouton>`
> `ComponentProps` fonctionne avec les éléments natifs (`'button'`) et avec n'importe quel composant. Utile pour envelopper un composant sans redéclarer ses props.
[doc]: React TypeScript Cheatsheet — ComponentProps (EN) | https://react-typescript-cheatsheet.netlify.app/docs/react-types/componentprops/

### Pourquoi déconseille-t-on souvent `React.FC<Props>` ?
- [ ] Il est supprimé en React 19
- [x] Il n'apporte pas grand-chose par rapport à une signature typée, gère mal les génériques, et a longtemps ajouté `children` implicitement (jusqu'à React 18)
- [ ] Il rend le composant plus lent
- [ ] Il est incompatible avec les hooks
> Typer directement les props (`function Bouton(props: BoutonProps)`) est plus simple et fonctionne avec les composants génériques. `FC` n'est pas interdit, c'est une question de convention d'équipe.
[doc]: React TypeScript Cheatsheet — Function components (EN) | https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/function_components/

### Quelles affirmations sur le typage React sont vraies ? (plusieurs réponses)
- [x] `useRef<HTMLDivElement>(null)` est la façon idiomatique de typer une ref DOM
- [x] Le type d'un événement dépend de l'élément : `React.MouseEvent<HTMLButtonElement>`
- [ ] Les props d'un composant sont vérifiées à l'exécution par TypeScript
- [x] Les génériques de composant sont inférés depuis les props passées
> TypeScript ne vérifie rien à l'exécution : des données d'API mal formées passeront dans les props. Valider à la frontière (Zod) reste nécessaire.
[doc]: React — Utiliser TypeScript | https://fr.react.dev/learn/typescript
