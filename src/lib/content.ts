import { parseModule } from './parser.ts';
import type { Module, Track, TrackId } from './types.ts';

export const TRACKS: Track[] = [
  {
    id: 'typescript',
    title: 'TypeScript',
    color: '#3178c6',
    description: 'Le langage : du système de types de base au typage avancé utilisé en entretien.',
  },
  {
    id: 'nestjs',
    title: 'NestJS',
    color: '#e0234e',
    description: 'Le backend : DI, cycle de requête, persistance, auth, tests et architecture.',
  },
  {
    id: 'react',
    title: 'React',
    color: '#087ea4',
    description: 'Le frontend : rendu, état, effets, hooks, data fetching, performance et tests.',
  },
  {
    id: 'fullstack',
    title: 'Fullstack senior',
    color: '#7c3aed',
    description: 'Ce qui fait la différence en entretien senior : archi, API, sécurité, prod.',
  },
];

const trackOrder: Record<TrackId, number> = Object.fromEntries(
  TRACKS.map((track, index) => [track.id, index]),
) as Record<TrackId, number>;

const files = import.meta.glob('../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const MODULES: Module[] = Object.entries(files)
  .map(([path, raw]) => parseModule(raw, path))
  .sort((a, b) => trackOrder[a.track] - trackOrder[b.track] || a.order - b.order)
  .map((module, index) => ({ ...module, step: index + 1 }));

export const ALL_QUESTIONS = MODULES.flatMap((module) => module.questions);

export function findModule(id: string): Module | undefined {
  return MODULES.find((module) => module.id === id);
}

export function trackOf(id: TrackId): Track {
  return TRACKS.find((track) => track.id === id)!;
}
