import { useCallback, useEffect, useState } from 'react';
import { findModule } from '../lib/content.ts';
import { getProgress, isMastered, recordAnswer, useProgress } from '../lib/progress.ts';
import { pickQuestions, shuffleOptions } from '../lib/quiz.ts';
import type { Question } from '../lib/types.ts';
import { InlineMarkdown, Markdown } from './Markdown.tsx';

interface QuizProps {
  pool: Question[];
  sizes: number[];
  showModule?: boolean;
  onFinished?: (scorePercent: number) => void;
}

interface Result {
  question: Question;
  chosen: number[];
  isCorrect: boolean;
}

type Phase = 'setup' | 'running' | 'done';

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((value) => b.includes(value));

export function Quiz({ pool, sizes, showModule = false, onFinished }: QuizProps) {
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>('setup');
  const [size, setSize] = useState(Math.min(sizes[0], pool.length));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [validated, setValidated] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const mastered = pool.filter((question) => isMastered(progress.questions[question.id])).length;
  const neverSeen = pool.filter((question) => !progress.questions[question.id]).length;
  const toReview = pool.filter((question) => progress.questions[question.id]?.lastCorrect === false).length;

  const start = (list: Question[]) => {
    setQuestions(list.map(shuffleOptions));
    setIndex(0);
    setSelected([]);
    setValidated(false);
    setResults([]);
    setPhase('running');
  };

  const startDraw = () => start(pickQuestions(pool, size, getProgress().questions));

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
    const choices = [...new Set([...sizes.filter((value) => value < pool.length), pool.length])];
    return (
      <div className="card quiz-setup">
        <h3>Configurer le quiz</h3>
        <div className="pool-stats">
          <span><strong>{pool.length}</strong> questions dans le pool</span>
          <span><strong>{mastered}</strong> maîtrisées</span>
          <span><strong>{neverSeen}</strong> jamais vues</span>
          {toReview > 0 && <span className="warn"><strong>{toReview}</strong> à revoir</span>}
        </div>
        <p className="muted">
          Le tirage privilégie les questions jamais vues et celles ratées la dernière fois. Les propositions sont
          mélangées à chaque passage.
        </p>
        <div className="size-picker">
          {choices.map((value) => (
            <button
              key={value}
              className={`chip ${size === value ? 'active' : ''}`}
              onClick={() => setSize(value)}
            >
              {value === pool.length ? `Tout (${value})` : `${value} questions`}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={startDraw}>Démarrer</button>
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
        {module && <div className="tag">Étape {module.step} · {module.title}</div>}
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
