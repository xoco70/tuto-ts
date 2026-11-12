---
id: react-bases
track: react
order: 1
title: Composants, JSX et props
level: Débutant
summary: Penser en composants, JSX, props et children, rendu conditionnel, listes et clés, composition.
---

## Le modèle mental

React est une librairie pour construire des interfaces à partir de **composants** : des fonctions qui reçoivent des **props** et retournent une description de l'UI (du JSX).

> **UI = f(état)**. On ne manipule pas le DOM : on décrit ce qu'on veut afficher pour un état donné, et React se charge de mettre le DOM à jour (réconciliation).

Pour un dev backend : un composant ressemble à une fonction pure de *templating*, qui est **ré-exécutée** à chaque changement d'état.

## JSX

```tsx
function Carte({ titre, prix }: { titre: string; prix: number }) {
  const enPromo = prix < 10;
  return (
    <div className="carte">                       {/* className, pas class */}
      <h2>{titre}</h2>                             {/* {} = expression JS */}
      {enPromo && <span>Promo !</span>}
      <p style={{ color: enPromo ? 'red' : 'black' }}>{prix} €</p>
      <label htmlFor="qte">Quantité</label>
    </div>
  );
}
```

- JSX est compilé en appels `jsx('div', props, ...)` : c'est du **JavaScript**, pas du HTML.
- Un composant retourne **un seul** élément racine → ou un **Fragment** `<>...</>`.
- Les noms de composants commencent par une **majuscule** (`<Carte />`) ; en minuscule, React crée une balise HTML.
- Le contenu entre `{}` est **échappé** : pas d'injection XSS, sauf avec `dangerouslySetInnerHTML`.

## Props et children

```tsx
function Panneau({ titre, children }: { titre: string; children: React.ReactNode }) {
  return <section><h3>{titre}</h3>{children}</section>;
}

<Panneau titre="Profil">
  <Avatar />
  <p>Contenu libre</p>
</Panneau>
```

Les props sont **en lecture seule** : un composant ne modifie jamais ses props. Les données descendent (parent → enfant), les événements remontent via des callbacks (`onChange`, `onSubmit`).

## Rendu conditionnel

```tsx
{isLoading ? <Spinner /> : <Liste />}
{erreur && <Alerte message={erreur} />}
{count > 0 && <Badge n={count} />}     // ✅
{count && <Badge n={count} />}         // ❌ affiche « 0 » quand count vaut 0
```

`false`, `null`, `undefined` et `true` ne s'affichent pas ; **`0` et `''` s'affichent** (`''` est invisible, mais `0` non).

## Listes et clés

```tsx
<ul>
  {produits.map((p) => <li key={p.id}>{p.nom}</li>)}
</ul>
```

La `key` permet à React d'**identifier** chaque élément entre deux rendus :
- elle doit être **stable** et **unique parmi les frères** (un id métier) ;
- l'**index** pose problème si la liste peut être réordonnée, filtrée ou recevoir des insertions : l'état (input, focus) reste attaché à la mauvaise ligne ;
- changer la `key` d'un composant le **démonte et remonte** (état réinitialisé) — astuce utile pour réinitialiser un formulaire.

## Composition plutôt qu'héritage

React n'utilise pas l'héritage de composants. On compose : `children`, props de rendu (`renderItem`), composants qui en enveloppent d'autres. Un composant = une responsabilité.

## Pureté

Un composant doit être **pur** pendant le rendu : mêmes props/état → même JSX, sans effet de bord (pas d'appel réseau, pas de mutation d'une variable externe). Les effets vont dans des **gestionnaires d'événements** ou, en dernier recours, dans `useEffect`.

<!-- QUIZ -->

### Qu'affiche ce composant quand `count` vaut `0` ?
```tsx
<div>{count && <Badge n={count} />}</div>
```
- [ ] Rien
- [x] `0`
- [ ] Le badge avec 0
- [ ] Une erreur
> `0 && ...` vaut `0`, et React affiche les nombres. Utiliser `count > 0 && ...` ou un ternaire. Piège très fréquent.
[doc]: React — Rendu conditionnel | https://fr.react.dev/learn/conditional-rendering

### Pourquoi utiliser l'index comme `key` peut-il poser problème ?
```tsx
{todos.map((t, i) => <TodoItem key={i} todo={t} />)}
```
- [ ] Les index ne sont pas uniques
- [x] Si la liste est réordonnée, filtrée ou reçoit une insertion en tête, l'état interne des composants reste associé à la mauvaise ligne
- [ ] React interdit les nombres comme clés
- [ ] Ce n'est jamais un problème
> React associe l'état à la position identifiée par la clé. Avec l'index, insérer un élément en tête « décale » tout : un input coché ou un texte saisi se retrouve sur un autre élément. Utiliser un id stable.
[doc]: React — Afficher des listes, clés | https://fr.react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key

### Que se passe-t-il quand la `key` d'un composant change ?
- [ ] Rien, seules ses props sont mises à jour
- [x] React démonte l'ancien composant et en monte un nouveau : son état est réinitialisé
- [ ] React affiche une erreur
- [ ] Le composant est rendu deux fois
> La clé fait partie de l'identité du composant. `<Formulaire key={userId} />` est une façon idiomatique de réinitialiser l'état quand on change d'utilisateur.
[doc]: React — Réinitialiser l'état avec une clé | https://fr.react.dev/learn/preserving-and-resetting-state#option-2-resetting-state-with-a-key

### Pourquoi le nom d'un composant doit-il commencer par une majuscule ?
- [ ] C'est une convention de style uniquement
- [x] JSX traite les noms en minuscule comme des balises HTML natives (`<carte>` → élément DOM `carte`) et ceux en majuscule comme des composants
- [ ] Pour TypeScript uniquement
- [ ] Pour le SEO
> `<carte />` serait compilé en `jsx('carte')` (une chaîne), `<Carte />` en `jsx(Carte)` (la fonction).
[doc]: React — Votre premier composant | https://fr.react.dev/learn/your-first-component

### Un composant enfant peut-il modifier les props qu'il reçoit ?
- [ ] Oui, directement
- [x] Non : les props sont en lecture seule ; l'enfant demande un changement au parent via une fonction callback passée en prop
- [ ] Oui, via `this.props`
- [ ] Oui, si le parent l'autorise avec `mutable`
> Flux de données unidirectionnel : l'état vit dans le parent, qui passe la valeur et un `onChange`. C'est le principe du *lifting state up*.
[doc]: React — Passer des props à un composant | https://fr.react.dev/learn/passing-props-to-a-component

### Quelle est la valeur de `children` dans `Panneau` ?
```tsx
<Panneau titre="A"><p>Bonjour</p><p>Monde</p></Panneau>
```
- [ ] Une chaîne HTML
- [x] Le contenu JSX placé entre les balises (ici deux éléments `<p>`)
- [ ] Un tableau de chaînes
- [ ] `undefined` : il faut le passer explicitement en prop
> `children` est une prop spéciale contenant ce qui est imbriqué. Son type le plus général est `React.ReactNode`.
[doc]: React — Passer du JSX comme children | https://fr.react.dev/learn/passing-props-to-a-component#passing-jsx-as-children

### Pourquoi ce composant est-il problématique ?
```tsx
let compteur = 0;
function Article({ titre }: { titre: string }) {
  compteur++;
  return <h2>#{compteur} {titre}</h2>;
}
```
- [ ] `let` est interdit dans un module
- [x] Le rendu n'est pas pur : il modifie une variable externe, le résultat dépend du nombre de rendus (et le StrictMode double les rendus en dev)
- [ ] Les composants ne peuvent pas afficher de nombres
- [ ] Il manque une `key`
> React peut rendre un composant plusieurs fois, dans n'importe quel ordre. Un rendu doit être une fonction pure de ses props, de son état et de son contexte.
[doc]: React — Garder les composants purs | https://fr.react.dev/learn/keeping-components-pure

### Comment retourner plusieurs éléments frères sans ajouter de `<div>` inutile ?
- [ ] Retourner un tableau sans clé
- [x] Utiliser un Fragment : `<>...</>` (ou `<Fragment key={...}>` dans une liste)
- [ ] Utiliser `<span>`
- [ ] C'est impossible
> Le Fragment ne produit aucun nœud DOM. La forme longue `<Fragment key={id}>` est nécessaire quand on veut une clé.
[doc]: React — Fragment | https://fr.react.dev/reference/react/Fragment

### Le texte `{commentaire}` contient `<script>alert(1)</script>`. Que se passe-t-il ?
```tsx
<p>{commentaire}</p>
```
- [ ] Le script s'exécute
- [x] Le texte est échappé et affiché littéralement : pas de XSS
- [ ] React lève une erreur
- [ ] Le contenu est supprimé
> React échappe tout contenu interpolé. Le risque XSS revient avec `dangerouslySetInnerHTML`, les URL `href="javascript:..."` construites depuis l'utilisateur, ou des manipulations directes du DOM.
[doc]: React — dangerouslySetInnerHTML | https://fr.react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html

### Quel attribut JSX correspond à l'attribut HTML `class` ?
- [ ] `class`
- [x] `className`
- [ ] `cssClass`
- [ ] `styleName`
> JSX suit les noms des propriétés DOM (`className`, `htmlFor`, `tabIndex`) et le camelCase pour les événements (`onClick`). `style` attend un objet : `style={{ marginTop: 8 }}`.
[doc]: React — Écrire du balisage avec JSX | https://fr.react.dev/learn/writing-markup-with-jsx

### Quelles valeurs ne produisent aucun affichage dans le JSX ? (plusieurs réponses)
- [x] `null`
- [x] `false`
- [x] `undefined`
- [ ] `0`
> `null`, `undefined`, `true` et `false` sont ignorés. `0` et `NaN` sont affichés.
[doc]: React — Rendu conditionnel | https://fr.react.dev/learn/conditional-rendering

### Quelle est la meilleure façon de rendre un composant `Liste` réutilisable avec un rendu d'élément personnalisable ?
- [ ] Créer une classe `ListeBase` et en hériter
- [x] Accepter une prop `renderItem={(item) => <...>}` ou des `children` (composition)
- [ ] Dupliquer le composant
- [ ] Utiliser un `switch` sur un type passé en prop
> React privilégie la composition : props de rendu, `children`, composants de plus haut niveau. L'héritage de composants n'est pas un pattern React.
[doc]: React — Penser en React | https://fr.react.dev/learn/thinking-in-react

### Où placer un appel réseau déclenché par le clic sur « Enregistrer » ?
- [ ] Dans le corps du composant, pendant le rendu
- [x] Dans le gestionnaire d'événement `onClick` / `onSubmit`
- [ ] Dans un `useEffect` qui surveille un booléen `clicked`
- [ ] Dans le `return` du composant
> Une action déclenchée par l'utilisateur va dans le gestionnaire d'événement. Passer par un état + `useEffect` ajoute un rendu inutile et des bugs. Les effets servent à **synchroniser** avec un système externe.
[doc]: React — Vous n'avez peut-être pas besoin d'un effet | https://fr.react.dev/learn/you-might-not-need-an-effect

### Quel est le bug de ce bouton ?
```tsx
<button onClick={supprimer(id)}>Supprimer</button>
```
- [ ] Aucun
- [x] `supprimer(id)` est **appelé pendant le rendu**, pas au clic
- [ ] `onClick` doit s'écrire `onclick`
- [ ] Il faut écrire `onClick="supprimer(id)"`
> `onClick` attend une **fonction**. Ici on lui passe le résultat de l'appel, exécuté à chaque rendu (et potentiellement en boucle si la fonction modifie l'état). Correction : `onClick={() => supprimer(id)}`.
[doc]: React — Réagir aux événements | https://fr.react.dev/learn/responding-to-events

### Pourquoi écrit-on `style={{ color: 'red', fontSize: 14 }}` avec deux paires d'accolades ?
- [ ] C'est une syntaxe spéciale de JSX pour les styles
- [x] La première paire ouvre une expression JS, la seconde est un objet littéral
- [ ] Pour échapper le CSS
- [ ] Pour activer les CSS Modules
> En JSX, `style` reçoit un **objet** dont les clés sont en camelCase (`fontSize`, pas `font-size`). Les nombres sont interprétés en pixels pour la plupart des propriétés.
[doc]: React — JavaScript dans JSX avec les accolades | https://fr.react.dev/learn/javascript-in-jsx-with-curly-braces

### Quand la valeur par défaut `taille = 100` est-elle utilisée ?
```tsx
function Avatar({ taille = 100 }: { taille?: number }) {}
```
- [ ] Quand `taille` vaut `0`
- [x] Quand la prop est absente ou vaut `undefined`
- [ ] Quand la prop vaut `null`
- [ ] Toujours, la prop est ignorée
> Les valeurs par défaut de la déstructuration ne s'appliquent qu'à `undefined`. Avec `<Avatar taille={null} />` ou `taille={0}`, la valeur fournie est conservée.
[doc]: React — Valeur par défaut d'une prop | https://fr.react.dev/learn/passing-props-to-a-component

### Que faut-il appeler pour empêcher le rechargement de la page à la soumission d'un `<form onSubmit={…}>` ?
- [ ] `e.stopPropagation()`
- [x] `e.preventDefault()`
- [ ] `return false` dans le handler
- [ ] Rien, React l'empêche automatiquement
> Le comportement natif d'un formulaire est de naviguer vers son `action`. `preventDefault()` l'annule. (Avec les Actions de React 19, `<form action={fn}>`, React s'en charge pour vous.)
[doc]: React — Empêcher le comportement par défaut | https://fr.react.dev/learn/responding-to-events

### Une `key` doit-elle être unique dans toute l'application ?
- [ ] Oui, comme un `id` HTML
- [x] Non : uniquement parmi les éléments frères d'une même liste
- [ ] Oui, sinon React lève une erreur
- [ ] Non, elle peut même être dupliquée dans la même liste
> React utilise la `key` pour associer un élément à son précédent rendu **au sein de la même liste**. Deux listes différentes peuvent réutiliser les mêmes clés. La clé doit en revanche rester stable entre les rendus.
[doc]: React — Règles des clés | https://fr.react.dev/learn/rendering-lists#rules-of-keys

### Pourquoi l'input perd-il le focus à chaque frappe ?
```tsx
function Formulaire() {
  const [texte, setTexte] = useState('');
  function Champ() {
    return <input value={texte} onChange={(e) => setTexte(e.target.value)} />;
  }
  return <Champ />;
}
```
- [ ] Parce que l'input n'a pas de `key`
- [x] Parce que `Champ` est redéfini à chaque rendu : React y voit un nouveau type de composant et recrée l'input
- [ ] Parce qu'il manque `useCallback`
- [ ] Parce que `onChange` est asynchrone
> Une fonction composant déclarée **dans** un autre composant est une nouvelle fonction à chaque rendu : React démonte l'ancien sous-arbre et monte le nouveau, en perdant l'état et le focus. Les composants se déclarent toujours au niveau du module.
[doc]: React — Préserver et réinitialiser l'état | https://fr.react.dev/learn/preserving-and-resetting-state

### Que fait `<StrictMode>` ?
- [ ] Il active le mode strict de TypeScript
- [x] En développement, il double certains rendus et effets pour révéler les impuretés et les nettoyages manquants
- [ ] Il interdit les composants classes
- [ ] Il ralentit l'application en production
> `StrictMode` n'a aucun effet en production. Il rend visibles les bugs qui apparaîtraient avec le rendu concurrent ou le Fast Refresh : effets sans cleanup, mutations pendant le rendu, API dépréciées.
[doc]: React — StrictMode | https://fr.react.dev/reference/react/StrictMode

### Que doit retourner un composant qui ne doit rien afficher dans certains cas ?
- [ ] `undefined`, obligatoirement
- [x] `null`
- [ ] `false` n'est pas autorisé
- [ ] Une `<div hidden>` vide
> Retourner `null` est l'usage idiomatique. (Depuis React 18, retourner `undefined` ne lève plus d'erreur, mais `null` exprime clairement l'intention.) Attention : le composant reste monté et ses hooks s'exécutent ; le parent peut aussi ne pas le rendre du tout.
[doc]: React — Ne rien renvoyer avec null | https://fr.react.dev/learn/conditional-rendering
