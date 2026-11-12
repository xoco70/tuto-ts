import type { DocLink, Module, Question, TrackId } from './types.ts';

/**
 * Format d'un fichier de module :
 *
 * ---
 * id: ts-01
 * track: typescript
 * order: 1
 * title: ...
 * level: Débutant
 * summary: ...
 * ---
 * (cours en Markdown)
 *
 * <!-- QUIZ -->
 *
 * ### Énoncé (peut continuer sur plusieurs lignes, blocs de code inclus)
 * - [ ] mauvaise réponse
 * - [x] bonne réponse          (plusieurs [x] = choix multiples)
 * > Explication (une ou plusieurs lignes)
 * [doc]: Libellé | https://lien
 */

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const OPTION = /^- \[( |x)\] (.+)$/;
const DOC = /^\[doc\]: (.+?) \| (\S+)\s*$/;

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function parseModule(raw: string, source: string): Omit<Module, 'step'> {
  const text = raw.replace(/\r\n/g, '\n');
  const match = FRONTMATTER.exec(text);
  if (!match) {
    throw new Error(`${source} : frontmatter manquant`);
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep > 0) {
      meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
  }
  for (const key of ['id', 'track', 'order', 'title', 'level', 'summary']) {
    if (!meta[key]) {
      throw new Error(`${source} : champ "${key}" manquant dans le frontmatter`);
    }
  }

  const [lesson, quiz = ''] = text.slice(match[0].length).split(/^<!-- QUIZ -->$/m);

  return {
    id: meta.id,
    track: meta.track as TrackId,
    order: Number(meta.order),
    title: meta.title,
    level: meta.level,
    summary: meta.summary,
    lesson: lesson.trim(),
    questions: parseQuestions(quiz, meta.id, source),
  };
}

function parseQuestions(src: string, moduleId: string, source: string): Question[] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  let inFence = false;

  for (const line of src.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence;
    }
    if (!inFence && line.startsWith('### ')) {
      current = [line.slice(4)];
      blocks.push(current);
      continue;
    }
    current?.push(line);
  }

  return blocks.map((block) => parseQuestion(block, moduleId, source));
}

function parseQuestion(lines: string[], moduleId: string, source: string): Question {
  const body: string[] = [];
  const options: string[] = [];
  const answers: number[] = [];
  const explanation: string[] = [];
  const docs: DocLink[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      body.push(line);
      continue;
    }
    if (!inFence) {
      const option = OPTION.exec(line);
      if (option) {
        if (option[1] === 'x') {
          answers.push(options.length);
        }
        options.push(option[2]);
        continue;
      }
      if (line.startsWith('>')) {
        explanation.push(line.replace(/^> ?/, ''));
        continue;
      }
      const doc = DOC.exec(line);
      if (doc) {
        docs.push({ label: doc[1], url: doc[2] });
        continue;
      }
    }
    body.push(line);
  }

  const text = body.join('\n').trim();
  if (options.length < 2 || answers.length === 0 || explanation.length === 0 || docs.length === 0) {
    throw new Error(
      `${source} : question invalide (options=${options.length}, bonnes=${answers.length}, explication=${explanation.length}, docs=${docs.length}) → "${text.slice(0, 80)}"`,
    );
  }

  return {
    id: `${moduleId}:${hash(text)}`,
    moduleId,
    body: text,
    options,
    answers,
    explanation: explanation.join('\n').trim(),
    docs,
  };
}
