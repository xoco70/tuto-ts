import { useEffect, useState } from 'react';
import { ALL_QUESTIONS, MODULES, TRACKS, findModule, trackOf } from './lib/content.ts';
import { isMastered, recordQuizScore, resetProgress, setLessonDone, useProgress } from './lib/progress.ts';
import type { Module, TrackId } from './lib/types.ts';
import { Markdown } from './components/Markdown.tsx';
import { Quiz } from './components/Quiz.tsx';

const PASS_SCORE = 80;

function useRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

function useModuleMastery(module: Module) {
  const progress = useProgress();
  const mastered = module.questions.filter((question) => isMastered(progress.questions[question.id])).length;
  const stat = progress.modules[module.id];
  return { mastered, total: module.questions.length, best: stat?.best ?? 0, lessonDone: !!stat?.lessonDone };
}

export function App() {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route.join('/')]);

  let page;
  if (route[0] === 'm' && route[1]) {
    const module = findModule(route[1]);
    page = module ? <ModulePage key={module.id} module={module} tab={route[2] === 'quiz' ? 'quiz' : 'cours'} /> : <NotFound />;
  } else if (route[0] === 'exam') {
    page = <ExamPage />;
  } else {
    page = <Home />;
  }

  return (
    <div className="layout">
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
        <a href="#/" className="brand"><span className="logo">TS</span> Parcours Fullstack TypeScript</a>
        <GlobalProgress />
      </header>
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Sidebar route={route} />
      </nav>
      <main className="content">{page}</main>
    </div>
  );
}

function GlobalProgress() {
  const progress = useProgress();
  const mastered = ALL_QUESTIONS.filter((question) => isMastered(progress.questions[question.id])).length;
  const percent = Math.round((mastered / ALL_QUESTIONS.length) * 100);
  return (
    <div className="global-progress" title={`${mastered} questions maîtrisées sur ${ALL_QUESTIONS.length}`}>
      <div className="bar"><div style={{ width: `${percent}%` }} /></div>
      <span>{percent}% maîtrisé</span>
    </div>
  );
}

function Sidebar({ route }: { route: string[] }) {
  const progress = useProgress();
  return (
    <>
      <a href="#/" className={`nav-link ${route.length === 0 ? 'active' : ''}`}>🏠 Accueil</a>
      <a href="#/exam" className={`nav-link ${route[0] === 'exam' ? 'active' : ''}`}>🎯 Examen blanc</a>
      {TRACKS.map((track) => (
        <div key={track.id} className="nav-track">
          <div className="nav-track-title" style={{ color: track.color }}>{track.title}</div>
          {MODULES.filter((module) => module.track === track.id).map((module) => {
            const best = progress.modules[module.id]?.best ?? 0;
            const status = best >= PASS_SCORE ? 'done' : (progress.modules[module.id]?.attempts ?? 0) > 0 ? 'started' : '';
            return (
              <a
                key={module.id}
                href={`#/m/${module.id}`}
                className={`nav-link module ${route[1] === module.id ? 'active' : ''}`}
              >
                <span className={`step ${status}`}>{status === 'done' ? '✓' : module.step}</span>
                <span className="nav-title">{module.title}</span>
              </a>
            );
          })}
        </div>
      ))}
      <button
        className="btn ghost small reset"
        onClick={() => {
          if (window.confirm('Effacer toute ta progression ?')) {
            resetProgress();
          }
        }}
      >
        Réinitialiser la progression
      </button>
    </>
  );
}

function Home() {
  const progress = useProgress();
  const nextModule = MODULES.find((module) => (progress.modules[module.id]?.best ?? 0) < PASS_SCORE) ?? MODULES[0];
  const answered = Object.values(progress.questions).reduce((sum, stat) => sum + stat.seen, 0);
  const mastered = ALL_QUESTIONS.filter((question) => isMastered(progress.questions[question.id])).length;
  const validated = MODULES.filter((module) => (progress.modules[module.id]?.best ?? 0) >= PASS_SCORE).length;

  return (
    <div className="home">
      <section className="hero">
        <h1>Devenir dev fullstack senior TypeScript</h1>
        <p>
          {MODULES.length} étapes progressives, de TypeScript à l'architecture fullstack, avec un cours puis un quiz
          tiré au hasard parmi <strong>{ALL_QUESTIONS.length} questions</strong>. Chaque réponse est expliquée, avec un
          lien vers la documentation (en français quand elle existe).
        </p>
        <div className="actions">
          <a className="btn primary" href={`#/m/${nextModule.id}`}>
            {answered === 0 ? 'Commencer' : 'Reprendre'} : étape {nextModule.step} — {nextModule.title}
          </a>
          <a className="btn" href="#/exam">Examen blanc</a>
        </div>
      </section>

      <section className="stats">
        <div className="card stat"><strong>{validated}/{MODULES.length}</strong><span>étapes validées (≥ {PASS_SCORE}%)</span></div>
        <div className="card stat"><strong>{mastered}/{ALL_QUESTIONS.length}</strong><span>questions maîtrisées</span></div>
        <div className="card stat"><strong>{answered}</strong><span>réponses données</span></div>
      </section>

      <section className="card how">
        <h2>Comment l'utiliser</h2>
        <ul>
          <li>Les étapes sont dans un ordre progressif, mais <strong>tout est accessible</strong> : saute directement à ce que tu veux depuis le menu.</li>
          <li>Tu connais déjà bien NestJS ? Fais directement le quiz des étapes NestJS : si tu as ≥ {PASS_SCORE}%, passe à la suite.</li>
          <li>Une question est <strong>maîtrisée</strong> quand tu l'as réussie au moins 2 fois, dont la dernière. Les questions ratées reviennent en priorité.</li>
          <li>Raccourcis clavier pendant un quiz : <kbd>1</kbd>…<kbd>9</kbd> pour choisir, <kbd>Entrée</kbd> pour valider / continuer.</li>
          <li>La progression est stockée dans ce navigateur (localStorage).</li>
        </ul>
      </section>

      <section className="tracks">
        {TRACKS.map((track) => {
          const modules = MODULES.filter((module) => module.track === track.id);
          return (
            <div key={track.id} className="card track" style={{ borderTopColor: track.color }}>
              <h2 style={{ color: track.color }}>{track.title}</h2>
              <p className="muted">{track.description}</p>
              <ol>
                {modules.map((module) => (
                  <ModuleRow key={module.id} module={module} />
                ))}
              </ol>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ModuleRow({ module }: { module: Module }) {
  const { mastered, total, best } = useModuleMastery(module);
  return (
    <li>
      <a href={`#/m/${module.id}`}>
        <span className="row-title">{module.step}. {module.title}</span>
        <span className="row-meta">
          {best > 0 && <span className={best >= PASS_SCORE ? 'good' : 'mid'}>{best}%</span>}
          <span className="muted">{mastered}/{total}</span>
        </span>
      </a>
    </li>
  );
}

function ModulePage({ module, tab }: { module: Module; tab: 'cours' | 'quiz' }) {
  const track = trackOf(module.track);
  const { mastered, total, best, lessonDone } = useModuleMastery(module);
  const previous = MODULES[module.step - 2];
  const following = MODULES[module.step];

  return (
    <article className="module">
      <div className="module-head">
        <div className="tag" style={{ background: track.color }}>Étape {module.step} · {track.title} · {module.level}</div>
        <h1>{module.title}</h1>
        <p className="muted">{module.summary}</p>
        <div className="module-meta">
          <span>{mastered}/{total} questions maîtrisées</span>
          {best > 0 && <span>Meilleur score : {best}%</span>}
        </div>
        <div className="tabs">
          <a href={`#/m/${module.id}`} className={tab === 'cours' ? 'active' : ''}>📘 Cours {lessonDone && '✓'}</a>
          <a href={`#/m/${module.id}/quiz`} className={tab === 'quiz' ? 'active' : ''}>✍️ Quiz ({total})</a>
        </div>
      </div>

      {tab === 'cours' ? (
        <>
          <div className="card lesson">
            <Markdown text={module.lesson} />
          </div>
          <div className="actions">
            <label className="check">
              <input type="checkbox" checked={lessonDone} onChange={(event) => setLessonDone(module.id, event.target.checked)} />
              J'ai lu ce cours
            </label>
            <a className="btn primary" href={`#/m/${module.id}/quiz`} onClick={() => setLessonDone(module.id, true)}>
              Passer au quiz →
            </a>
          </div>
        </>
      ) : (
        <Quiz pool={module.questions} sizes={[10, 20]} onFinished={(score) => recordQuizScore(module.id, score)} />
      )}

      <div className="pager">
        {previous ? <a href={`#/m/${previous.id}`}>← {previous.step}. {previous.title}</a> : <span />}
        {following ? <a href={`#/m/${following.id}`}>{following.step}. {following.title} →</a> : <a href="#/exam">Examen blanc →</a>}
      </div>
    </article>
  );
}

function ExamPage() {
  const [tracks, setTracks] = useState<TrackId[]>(TRACKS.map((track) => track.id));
  const pool = ALL_QUESTIONS.filter((question) => tracks.includes(findModule(question.moduleId)!.track));

  const toggleTrack = (id: TrackId) =>
    setTracks((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));

  return (
    <article className="module">
      <div className="module-head">
        <h1>Examen blanc</h1>
        <p className="muted">
          Questions mélangées de toutes les étapes choisies — idéal pour simuler un test technique ou réviser avant un
          entretien.
        </p>
        <div className="size-picker">
          {TRACKS.map((track) => (
            <button key={track.id} className={`chip ${tracks.includes(track.id) ? 'active' : ''}`} onClick={() => toggleTrack(track.id)}>
              {track.title}
            </button>
          ))}
        </div>
      </div>
      <Quiz key={tracks.join(',')} pool={pool} sizes={[20, 40, 60]} showModule />
    </article>
  );
}

function NotFound() {
  return (
    <div className="card">
      <h1>Étape introuvable</h1>
      <a href="#/">Retour à l'accueil</a>
    </div>
  );
}
