import { useSyncExternalStore } from 'react';

export interface QuestionStat {
  seen: number;
  correct: number;
  lastCorrect: boolean;
  lastSeen: number;
}

export interface ModuleStat {
  best: number;
  attempts: number;
  lessonDone: boolean;
}

export interface Progress {
  questions: Record<string, QuestionStat>;
  modules: Record<string, ModuleStat>;
}

const KEY = 'tuto-ts:progress:v1';
const empty = (): Progress => ({ questions: {}, modules: {} });

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

let state: Progress = load();
const listeners = new Set<() => void>();

function commit(next: Progress): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée…) : la progression reste en mémoire.
  }
  listeners.forEach((listener) => listener());
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function getProgress(): Progress {
  return state;
}

export function recordAnswer(questionId: string, isCorrect: boolean): void {
  const previous = state.questions[questionId] ?? { seen: 0, correct: 0, lastCorrect: false, lastSeen: 0 };
  commit({
    ...state,
    questions: {
      ...state.questions,
      [questionId]: {
        seen: previous.seen + 1,
        correct: previous.correct + (isCorrect ? 1 : 0),
        lastCorrect: isCorrect,
        lastSeen: Date.now(),
      },
    },
  });
}

export function recordQuizScore(moduleId: string, scorePercent: number): void {
  const previous = state.modules[moduleId] ?? { best: 0, attempts: 0, lessonDone: false };
  commit({
    ...state,
    modules: {
      ...state.modules,
      [moduleId]: { ...previous, best: Math.max(previous.best, scorePercent), attempts: previous.attempts + 1 },
    },
  });
}

export function setLessonDone(moduleId: string, lessonDone: boolean): void {
  const previous = state.modules[moduleId] ?? { best: 0, attempts: 0, lessonDone: false };
  commit({ ...state, modules: { ...state.modules, [moduleId]: { ...previous, lessonDone } } });
}

export function resetProgress(): void {
  commit(empty());
}

/** Une question est « maîtrisée » quand elle a été réussie au moins 2 fois et la dernière fois. */
export function isMastered(stat: QuestionStat | undefined): boolean {
  return !!stat && stat.lastCorrect && stat.correct >= 2;
}
