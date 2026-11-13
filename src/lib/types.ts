export type TrackId = 'typescript' | 'nodejs' | 'nestjs' | 'react' | 'fullstack';

export interface Track {
  id: TrackId;
  title: string;
  color: string;
  description: string;
}

export interface DocLink {
  label: string;
  url: string;
}

/** 1 = facile, 2 = intermédiaire (par défaut), 3 = avancé. */
export type Difficulty = 1 | 2 | 3;

export interface Question {
  /** Identifiant stable : module + hash de l'énoncé (survit aux réordonnancements). */
  id: string;
  moduleId: string;
  body: string;
  options: string[];
  /** Index des bonnes réponses dans `options` (plusieurs = QCM à choix multiples). */
  answers: number[];
  explanation: string;
  docs: DocLink[];
  difficulty: Difficulty;
}

export interface Module {
  id: string;
  track: TrackId;
  order: number;
  title: string;
  level: string;
  summary: string;
  lesson: string;
  questions: Question[];
  /** Numéro d'étape global dans le parcours recommandé. */
  step: number;
}
