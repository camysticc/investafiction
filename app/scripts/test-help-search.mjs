// Question bank test (plan section 13.4): every question is run against the
// shipped index. At least 95 percent must find the right article in the top three.
import { readFileSync } from "node:fs";
import { loadIndex, search } from "../src/help/engine.js";
const { articles } = JSON.parse(readFileSync(new URL("../src/content/help/build/articles.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(articles.map((a) => [a.id, a]));
const ms = loadIndex(readFileSync(new URL("../src/content/help/build/index.json", import.meta.url), "utf8"));
const lines = readFileSync(new URL("../../tools/content/questions.tsv", import.meta.url), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
let pass = 0;
const fails = [];
const missing = [];
for (const line of lines) {
  const [q, exp] = line.split("\t");
  const want = exp.split("|").map((s) => s.trim());
  for (const w of want) if (!byId[w]) missing.push(`${w} (for "${q}")`);
  const top = search(ms, byId, q).slice(0, 3).map((r) => r.id);
  if (top.some((t) => want.includes(t))) pass++;
  else fails.push(`  "${q}" -> ${top.join(", ") || "nothing"} (wanted ${want.join(" or ")})`);
}
const pct = (100 * pass) / lines.length;
console.log(`help search: ${pass}/${lines.length} questions in the top three (${pct.toFixed(1)}%)`);
if (missing.length) { console.log("Unknown expected articles:\n  " + missing.join("\n  ")); process.exit(1); }
if (fails.length) console.log(fails.join("\n"));
if (pct < 95) { console.log("FAILED: below 95 percent"); process.exit(1); }
