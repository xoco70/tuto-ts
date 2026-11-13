import { useCallback, useEffect, useState } from 'react';
import { findModule } from '../lib/content.ts';
import { getProgress, isMastered, recordAnswer, useProgress } from '../lib/progress.ts';
import {
  byDifficulty,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  difficultyLadder,
  filterByDifficulty,
  pickQuestions,
  shuffleOptions,
  type DifficultyMode,
} from '../lib/quiz.ts';
import type { Question } from '../lib/types.ts';
import { InlineMarkdown, Markdown } from './Markdown.tsx';

interface QuizProps {
  pool: Question[];
  sizes: number[];
  showModule?: boolean;
  defaultMode?: DifficultyMode;
  onFinished?: (scorePercent: number) => void;
}

interface Result {
  question: Question;
  chosen: number[];
  isCorrect: boolean;
}

type Phase = 'setup' | 'running' | 'done';

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((value) => b.includes(value));

export function Quiz({ pool, sizes, showModule = false, defaultMode = 'progressive', onFinished }: QuizProps) {
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<DifficultyMode>(defaultMode);
  const [size, setSize] = useState<number | 'all'>(sizes[0]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [validated, setValidated] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const mastered = pool.filter((question) => isMastered(progress.questions[question.id])).length;
  const neverSeen = pool.filter((question) => !progress.questions[question.id]).length;
  const toReview = pool.filter((question) => progress.questions[question.id]?.lastCorrect === false).length;

  const ladder = difficultyLadder(pool, progress.questions);
  const drawPool = filterByDifficulty(pool, mode, progress.questions);
  const drawSize = size === 'all' ? drawPool.length : Math.min(size, drawPool.length);

  const start = (list: Question[]) => {
    setQuestions(byDifficulty(list).map(shuffleOptions));
    setIndex(0);
    setSelected([]);
    setValidated(false);
    setResults([]);
    setPhase('running');
  };

  const startDraw = () => {
    const stats = getProgress().questions;
    start(pickQuestions(filterByDifficulty(pool, mode, stats), drawSize, stats));
  };

  const current = questions[index];
  const isMulti = (current?.answers.length ?? 0) > 1;

  const toggle = useCallback(
    (option: number) => {
      if (validated || !current) {
        return;
      }
      if (current.answers.length > 1) {
        setSelected((previous) =>
          previous.includes(option) ? previous.filter((value) => value !== option) : [...previous, option],
        );
      } else {
        setSelected([option]);
      }
    },
    [validated, current],
  );

  const validate = useCallback(() => {
    if (!current || selected.length === 0 || validated) {
      return;
    }
    const isCorrect = sameSet(selected, current.answers);
    recordAnswer(current.id, isCorrect);
    setResults((previous) => [...previous, { question: current, chosen: selected, isCorrect }]);
    setValidated(true);
  }, [current, selected, validated]);

  const next = useCallback(() => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected([]);
      setValidated(false);
      return;
    }
    const score = Math.round((results.filter((result) => result.isCorrect).length / results.length) * 100);
    onFinished?.(score);
    setPhase('done');
  }, [index, questions.length, results, onFinished]);

  useEffect(() => {
    if (phase !== 'running') {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) {
        toggle(digit - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (validated) {
          next();
        } else {
          validate();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, toggle, validate, next, validated]);

  if (pool.length === 0) {
    return <p className="muted">Aucune question dans cette sélection.</p>;
  }

  if (phase === 'setup') {
    const levels = ladder.filter((status) => status.total > 0);
    const sizeChoices = sizes.filter((value) => value < drawPool.length);
    const nextLock = levels.find((status) => !status.unlocked);
    const currentLevel = [...levels].reverse().find((status) => status.unlocked);
    return (
      <div className="card quiz-setup">
        <h3>Configurer le quiz</h3>
        <div className="pool-stats">
          <span><strong>{pool.length}</strong> questions dans le pool</span>
          <span><strong>{mastered}</strong> maîtrisées</span>
          <span><strong>{neverSeen}</strong> jamais vues</span>
          {toReview > 0 && <span className="warn"><strong>{toReview}</strong> à revoir</span>}
        </div>

        <h4>Difficulté</h4>
        <div className="size-picker">
          <button className={`chip ${mode === 'progressive' ? 'active' : ''}`} onClick={() => setMode('progressive')}>
            Progressive
          </button>
          {DIFFICULTIES.filter((level) => ladder[level - 1].total > 0).map((level) => (
            <button
              key={level}
              className={`chip ${mode === level ? 'active' : ''}`}
              onClick={() => setMode(level)}
            >
              {DIFFICULTY_LABELS[level]} ({ladder[level - 1].total})
            </button>
          ))}
          <button className={`chip ${mode === 'all' ? 'active' : ''}`} onClick={() => setMode('all')}>
            Toutes
          </button>
        </div>

        {mode === 'progressive' && levels.length > 1 && (
          <>
            <ol className="ladder">
              {levels.map((status) => {
                const done = status.passed >= status.needed;
                const state = !status.unlocked ? 'locked' : done ? 'done' : 'current';
                return (
                  <li key={status.level} className={state}>
                    <span className={`level-badge level-${status.level}`}>
                      {state === 'locked' ? '🔒' : done ? '✓' : '▶'} {DIFFICULTY_LABELS[status.level]}
                    </span>
                    <span className="muted">{status.passed} / {status.total} réussies</span>
                  </li>
                );
              })}
            </ol>
            <p className="muted">
              {nextLock && currentLevel
                ? `Réussis encore ${currentLevel.needed - currentLevel.passed} question${currentLevel.needed - currentLevel.passed > 1 ? 's' : ''} de niveau ${DIFFICULTY_LABELS[currentLevel.level].toLowerCase()} pour débloquer le niveau ${DIFFICULTY_LABELS[nextLock.level].toLowerCase()}.`
                : 'Tous les niveaux sont débloqués.'}
            </p>
          </>
        )}

        <p className="muted">
          Chaque série va du plus facile au plus difficile. Le tirage privilégie les questions jamais vues et celles
          ratées la dernière fois, et les propositions sont mélangées à chaque passage.
        </p>

        <h4>Nombre de questions</h4>
        <div className="size-picker">
          {sizeChoices.map((value) => (
            <button
              key={value}
              className={`chip ${size === value ? 'active' : ''}`}
              onClick={() => setSize(value)}
            >
              {value} questions
            </button>
          ))}
          <button
            className={`chip ${drawSize === drawPool.length ? 'active' : ''}`}
            onClick={() => setSize('all')}
          >
            Tout ({drawPool.length})
          </button>
        </div>
        <button className="btn primary" onClick={startDraw} disabled={drawSize === 0}>Démarrer</button>
      </div>
    );
  }

  if (phase === 'done') {
    const good = results.filter((result) => result.isCorrect).length;
    const score = Math.round((good / results.length) * 100);
    const errors = results.filter((result) => !result.isCorrect);
    return (
      <div className="quiz-done">
        <div className={`card score ${score >= 80 ? 'ok' : score >= 50 ? 'mid' : 'ko'}`}>
          <div className="score-value">{score}%</div>
          <div>
            {good} / {results.length} bonnes réponses
            <p className="muted">
              {score >= 80
                ? 'Étape validée. Tu peux passer à la suite.'
                : score >= 50
                  ? 'Pas mal, mais relis les explications ci-dessous puis refais un tirage.'
                  : 'Relis le cours, puis refais un tirage : les questions ratées reviendront en priorité.'}
            </p>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startDraw}>Nouveau tirage</button>
          {errors.length > 0 && (
            <button className="btn" onClick={() => start(errors.map((error) => error.question))}>
              Refaire mes {errors.length} erreur{errors.length > 1 ? 's' : ''}
            </button>
          )}
          <button className="btn ghost" onClick={() => setPhase('setup')}>Changer la taille</button>
        </div>
        {errors.length > 0 && (
          <>
            <h3>À retenir</h3>
            {errors.map((error) => (
              <div key={error.question.id} className="card review">
                <Markdown text={error.question.body} />
                <p className="answer-line">
                  <span className="bad">Ta réponse :</span>{' '}
                  {error.chosen.map((choice) => <InlineMarkdown key={choice} text={error.question.options[choice]} />)}
                </p>
                <p className="answer-line">
                  <span className="good">Bonne réponse :</span>{' '}
                  {error.question.answers.map((answer) => (
                    <InlineMarkdown key={answer} text={error.question.options[answer]} />
                  ))}
                </p>
                <Explanation question={error.question} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  const isCorrect = validated && sameSet(selected, current.answers);
  const module = showModule ? findModule(current.moduleId) : undefined;

  return (
    <div className="quiz">
      <div className="quiz-progress">
        <span>Question {index + 1} / {questions.length}</span>
        <div className="bar"><div style={{ width: `${(index / questions.length) * 100}%` }} /></div>
        <span>{results.filter((result) => result.isCorrect).length} ✓</span>
      </div>
      <div className="card question">
        <div className="question-tags">
          <span className={`level-badge level-${current.difficulty}`}>{DIFFICULTY_LABELS[current.difficulty]}</span>
          {module && <span className="tag">Étape {module.step} · {module.title}</span>}
        </div>
        <Markdown text={current.body} />
        {isMulti && <p className="hint">Plusieurs réponses possibles ({current.answers.length} attendues)</p>}
        <div className="options">
          {current.options.map((option, optionIndex) => {
            const chosen = selected.includes(optionIndex);
            const right = current.answers.includes(optionIndex);
            const state = validated ? (right ? 'right' : chosen ? 'wrong' : 'dim') : chosen ? 'chosen' : '';
            return (
              <button
                key={optionIndex}
                className={`option ${state} ${isMulti ? 'multi' : ''}`}
                onClick={() => toggle(optionIndex)}
                disabled={validated}
              >
                <span className="key">{optionIndex + 1}</span>
                <InlineMarkdown text={option} />
              </button>
            );
          })}
        </div>
        {validated && (
          <div className={`feedback ${isCorrect ? 'ok' : 'ko'}`}>
            <strong>{isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse.'}</strong>
            <Explanation question={current} />
          </div>
        )}
        <div className="actions">
          {validated ? (
            <button className="btn primary" onClick={next}>
              {index + 1 < questions.length ? 'Question suivante' : 'Voir le résultat'} <kbd>Entrée</kbd>
            </button>
          ) : (
            <button className="btn primary" onClick={validate} disabled={selected.length === 0}>
              Valider <kbd>Entrée</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Explanation({ question }: { question: Question }) {
  const lesson = findModule(question.moduleId);
  return (
    <div className="explanation">
      <Markdown text={question.explanation} />
      <ul className="docs">
        {lesson && (
          <li>
            📘 Cours de référence : <a href={`#/m/${lesson.id}`}>Étape {lesson.step} — {lesson.title}</a>
          </li>
        )}
        {question.docs.map((doc) => (
          <li key={doc.url}>
            📖 <a href={doc.url} target="_blank" rel="noreferrer">{doc.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
