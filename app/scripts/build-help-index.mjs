// Builds the help search index at build time and ships it inside the program.
import { readFileSync, writeFileSync } from "node:fs";
import { buildIndex } from "../src/help/engine.js";
const src = new URL("../src/content/help/build/articles.json", import.meta.url);
const { articles } = JSON.parse(readFileSync(src, "utf8"));
const ms = buildIndex(articles);
writeFileSync(new URL("../src/content/help/build/index.json", import.meta.url), JSON.stringify(ms));
console.log(`help index: ${articles.length} entries`);
