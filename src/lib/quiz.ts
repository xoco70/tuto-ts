import type { Question } from './types.ts';
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
