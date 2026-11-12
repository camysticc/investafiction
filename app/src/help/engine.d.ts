import type MiniSearch from "minisearch";
export type Article = {
  id: string; title: string; category: string; answer: string; body: string; questions: string[]; synonyms: string[];
  tags: string[]; related: string[]; features: string[]; lesson: string | null; errors: string[]; version?: string;
};
export function stem(w: string): string;
export function processTerm(t: string): string | null;
export const OPTIONS: any;
export function buildIndex(a: Article[]): MiniSearch;
export function loadIndex(json: unknown): MiniSearch;
export function search(ms: MiniSearch, byId: Record<string, Article>, q: string, opts?: { filter?: (a: Article) => boolean }): { id: string; score: number; article: Article }[];
