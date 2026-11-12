// Help centre search engine. Plain JavaScript so the app and the build-time
// question bank test use exactly the same code. Offline, no network.
import MiniSearch from "minisearch";

const STOP = new Set("a an the i me my do does did is are am be to of in on for with how what why can could should would will it this that there where when which who you your we our and or if".split(" "));

/** Lower case, drop punctuation, and trim common English endings so
 * 'timelines', 'timeline' and 'timelining' meet. */
export function stem(w) {
  w = w.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
export function processTerm(term) {
  const t = term.toLowerCase();
  if (STOP.has(t)) return null;
  const s = stem(t);
  return s.length ? s : null;
}

export const OPTIONS = {
  idField: "id",
  fields: ["title", "answer", "body", "questions", "synonyms", "tags", "category"],
  storeFields: ["id"],
  extractField: (doc, field) => {
    const v = doc[field];
    return Array.isArray(v) ? v.join(" . ") : v ?? "";
  },
  processTerm,
  searchOptions: {
    boost: { questions: 4, title: 3, synonyms: 2.5, tags: 1.5, answer: 1.3, body: 1, category: 0.5 },
    fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    prefix: (term) => term.length > 3,
    combineWith: "OR",
  },
};

export function buildIndex(articles) {
  const ms = new MiniSearch(OPTIONS);
  ms.addAll(articles);
  return ms;
}
export function loadIndex(json) {
  return MiniSearch.loadJSON(typeof json === "string" ? json : JSON.stringify(json), OPTIONS);
}

/** Search, then nudge results: settings articles drop a little unless the
 * query is clearly about a setting, glossary entries drop unless it asks
 * what something is or means. */
export function search(ms, articlesById, query, opts = {}) {
  const q = query.trim();
  if (!q) return [];
  const isWhat = /^(what|whats|what's)\s+(is|are|does|do)\b|\bmean(s|ing)?\b|\bdefin/i.test(q);
  const isSetting = /\b(setting|turn (on|off)|switch (on|off)|option|enable|disable|default|hide|show|stop|mute|unmute|bigger|smaller|more|less|fewer|thicker|start as|as a list|as cards)\b/i.test(q);
  const res = ms.search(q, opts.filter ? { filter: (r) => opts.filter(articlesById[r.id]) } : undefined);
  const seen = new Set();
  return res
    .map((r) => {
      const a = articlesById[r.id];
      let score = r.score;
      if (a.category === "Settings reference" && !isSetting) score *= 0.55;
      if (a.category === "Glossary") score *= isWhat ? 1.1 : 0.45;
      return { id: r.id, score, article: a };
    })
    .sort((x, y) => y.score - x.score)
    .filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
}
