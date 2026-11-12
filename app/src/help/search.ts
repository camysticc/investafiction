/* Loads the shipped help index and articles, and keeps the player's local help
 * data (recent searches, 'Was this helpful?' answers, questions with no answer)
 * in its own small file through the core (store "help"). Nothing is sent anywhere. */
import type MiniSearch from "minisearch";
import { call } from "../lib/api";
import { get as setting } from "../lib/settings";
import { loadIndex, search, type Article } from "./engine.js";

let ms: MiniSearch | null = null;
let byId: Record<string, Article> = {};
let all: Article[] = [];

export async function warmUp() {
  if (ms) return;
  const [arts, idx] = await Promise.all([import("../content/help/build/articles.json"), import("../content/help/build/index.json")]);
  all = (arts as any).default?.articles ?? (arts as any).articles;
  byId = Object.fromEntries(all.map((a) => [a.id, a]));
  ms = loadIndex((idx as any).default ?? idx);
  await loadHelpData();
}
export const articles = () => all;
export const article = (id: string) => byId[id] ?? null;
export function find(q: string, category?: string) {
  if (!ms) return [];
  return search(ms, byId, q, category ? { filter: (a) => a.category === category } : undefined);
}
/** The article that best explains an error message, if any. */
export function articleForError(message: string): Article | null {
  const m = message.toLowerCase();
  let best: Article | null = null;
  let bestLen = 0;
  for (const a of all) for (const p of a.errors) {
    const pl = p.toLowerCase().trim();
    if (pl.length > 3 && m.includes(pl) && pl.length > bestLen) { best = a; bestLen = pl.length; }
  }
  return best;
}

type HelpData = { recent: string[]; helpful: Record<string, "yes" | "no">; unanswered: { q: string; at: string }[] };
let data: HelpData = { recent: [], helpful: {}, unanswered: [] };
async function loadHelpData() {
  try {
    const r = await call<{ data: any }>("store.get", { name: "help" });
    if (r.data && typeof r.data === "object") data = { recent: r.data.recent ?? [], helpful: r.data.helpful ?? {}, unanswered: r.data.unanswered ?? [] };
  } catch { /* defaults */ }
}
function save() {
  call("store.set", { name: "help", data }).catch(() => {});
}
export const helpData = () => data;
export function rememberSearch(q: string) {
  const n = Number(setting("academy.help_search_history")) || 0;
  if (!n || !q.trim()) return;
  data.recent = [q.trim(), ...data.recent.filter((x) => x !== q.trim())].slice(0, n);
  save();
}
export function clearRecent() { data.recent = []; save(); }
export function markHelpful(id: string, v: "yes" | "no") { data.helpful[id] = v; save(); }
export function saveUnanswered(q: string) {
  if (!data.unanswered.some((u) => u.q === q)) data.unanswered = [{ q, at: new Date().toISOString() }, ...data.unanswered].slice(0, 200);
  save();
}
export function clearUnanswered() { data.unanswered = []; save(); }
