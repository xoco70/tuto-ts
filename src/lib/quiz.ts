import type { Difficulty, Question } from './types.ts';
import type { QuestionStat } from './progress.ts';

/**
 * Poids de tirage : on favorise les questions jamais vues et celles ratées la dernière fois,
 * et on espace celles déjà réussies plusieurs fois (répétition espacée simplifiée).
 */
function weight(stat: QuestionStat | undefined): number {
  if (!stat) {
    return 5;
  }
  if (!stat.lastCorrect) {
    return 8;
  }
  return 1 / (1 + stat.correct);
}

/** Tirage pondéré sans remise. */
export function pickQuestions(pool: Question[], count: number, stats: Record<string, QuestionStat>): Question[] {
  const remaining = pool.map((question) => ({ question, weight: weight(stats[question.id]) }));
  const picked: Question[] = [];

  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    let target = Math.random() * total;
    let index = 0;
    while (index < remaining.length - 1 && target >= remaining[index].weight) {
      target -= remaining[index].weight;
      index++;
    }
    picked.push(remaining[index].question);
    remaining.splice(index, 1);
  }

  return picked;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Mélange l'ordre des propositions en conservant la correspondance avec les bonnes réponses. */
export function shuffleOptions(question: Question): Question {
  const order = shuffle(question.options.map((_, index) => index));
  return {
    ...question,
    options: order.map((index) => question.options[index]),
    answers: order.flatMap((original, position) => (question.answers.includes(original) ? [position] : [])),
  };
}

export const DIFFICULTIES: Difficulty[] = [1, 2, 3];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { 1: 'Facile', 2: 'Intermédiaire', 3: 'Avancé' };

/** `progressive` : n'ouvre un niveau qu'une fois le précédent réussi ; `all` : tout le pool ; sinon un seul niveau. */
export type DifficultyMode = 'progressive' | 'all' | Difficulty;

/** Part des questions d'un niveau à avoir réussies (dernière tentative) pour débloquer le suivant. */
export const UNLOCK_RATIO = 0.6;

export interface LevelStatus {
  level: Difficulty;
  total: number;
  /** Questions de ce niveau réussies à la dernière tentative. */
  passed: number;
  /** Nombre de réussites nécessaires pour débloquer le niveau suivant. */
  needed: number;
  unlocked: boolean;
}

/** État du mode progressif : un niveau est ouvert quand tous les niveaux (non vides) précédents sont validés. */
export function difficultyLadder(pool: Question[], stats: Record<string, QuestionStat>): LevelStatus[] {
  let open = true;
  return DIFFICULTIES.map((level) => {
    const atLevel = pool.filter((question) => question.difficulty === level);
    const passed = atLevel.filter((question) => stats[question.id]?.lastCorrect).length;
    const needed = Math.ceil(atLevel.length * UNLOCK_RATIO);
    const status = { level, total: atLevel.length, passed, needed, unlocked: open };
    open = open && passed >= needed;
    return status;
  });
}

export function filterByDifficulty(
  pool: Question[],
  mode: DifficultyMode,
  stats: Record<string, QuestionStat>,
): Question[] {
  if (mode === 'all') {
    return pool;
  }
  if (mode === 'progressive') {
    const unlocked = new Set(difficultyLadder(pool, stats).filter((s) => s.unlocked).map((s) => s.level));
    return pool.filter((question) => unlocked.has(question.difficulty));
  }
  return pool.filter((question) => question.difficulty === mode);
}

/** Ordonne une série du plus facile au plus difficile (tri stable : l'ordre aléatoire est conservé dans un niveau). */
export function byDifficulty(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => a.difficulty - b.difficulty);
}
