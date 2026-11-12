import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseModule } from '../src/lib/parser.ts';

/** Vérifie que tous les fichiers de contenu se parsent et qu'aucun identifiant n'est dupliqué. */
const root = new URL('../src/content/', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : [];
  });
}

const moduleIds = new Set<string>();
const questionIds = new Map<string, string>();
let total = 0;
let failed = false;

for (const file of walk(root).sort()) {
  const source = relative(root, file);
  try {
    const module = parseModule(readFileSync(file, 'utf8'), source);
    if (moduleIds.has(module.id)) {
      throw new Error(`${source} : id de module dupliqué "${module.id}"`);
    }
    moduleIds.add(module.id);
    for (const question of module.questions) {
      if (questionIds.has(question.id)) {
        throw new Error(`${source} : question dupliquée (déjà dans ${questionIds.get(question.id)}) → "${question.body.slice(0, 60)}"`);
      }
      questionIds.set(question.id, source);
    }
    total += module.questions.length;
    console.log(`✓ ${source.padEnd(40)} ${String(module.questions.length).padStart(3)} questions`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${(error as Error).message}`);
  }
}

console.log(`\n${moduleIds.size} modules, ${total} questions`);
if (failed) {
  process.exit(1);
}
