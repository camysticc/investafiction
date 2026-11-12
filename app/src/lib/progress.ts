/* Academy progress: the quick intro missions, the lessons, the practice case,
 * badges and streaks. Kept in its own small local file through the core
 * (store "academy"). Nothing here ever changes a case score. */
import { useSyncExternalStore } from "react";
import { call } from "./api";

export type LessonRecord = { done: boolean; first_try: boolean; sandbox: boolean; xp: number; at: string };
export type Progress = {
  academy: "new" | "skipped" | "started" | "done";
  missions: Record<string, { xp: number; flawless: boolean }>;
  tour: "new" | "skipped" | "done";
  lessons: Record<string, LessonRecord>;
  tracks_done: string[];
  practice: { done: boolean; at?: string; xp?: number };
  badges: string[];
  seen_tools: string[];
  counters: { help_searches: number; settings_changed: number };
  streak: { enabled: boolean; last: string; count: number };
};

const EMPTY: Progress = {
  academy: "new", missions: {}, tour: "new", lessons: {}, tracks_done: [], practice: { done: false }, badges: [],
  seen_tools: [], counters: { help_searches: 0, settings_changed: 0 }, streak: { enabled: false, last: "", count: 0 },
};
const listeners = new Set<() => void>();
let current: Progress = structuredCloneSafe(EMPTY);
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function structuredCloneSafe<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function normalise(raw: any): Progress {
  const p = structuredCloneSafe(EMPTY);
  if (!raw || typeof raw !== "object") return p;
  if (["new", "skipped", "started", "done"].includes(raw.academy)) p.academy = raw.academy;
  if (["new", "skipped", "done"].includes(raw.tour)) p.tour = raw.tour;
  for (const k of ["missions", "lessons"] as const) if (raw[k] && typeof raw[k] === "object") (p as any)[k] = raw[k];
  for (const k of ["tracks_done", "badges", "seen_tools"] as const) if (Array.isArray(raw[k])) (p as any)[k] = raw[k].filter((x: unknown) => typeof x === "string");
  if (raw.practice && typeof raw.practice === "object") p.practice = { ...p.practice, ...raw.practice };
  if (raw.counters && typeof raw.counters === "object") p.counters = { ...p.counters, ...raw.counters };
  if (raw.streak && typeof raw.streak === "object") p.streak = { ...p.streak, ...raw.streak };
  return p;
}

export async function loadProgress() {
  try {
    const r = await call<{ data: unknown }>("store.get", { name: "academy" });
    let raw = r.data;
    if (!raw) {
      try {
        raw = JSON.parse(localStorage.getItem("investafiction.progress.v1") || "null");
      } catch {
        raw = null;
      }
    }
    current = normalise(raw);
  } catch {
    current = structuredCloneSafe(EMPTY);
  }
  listeners.forEach((l) => l());
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    call("store.set", { name: "academy", data: current }).catch(() => {
      try {
        localStorage.setItem("investafiction.progress.v1", JSON.stringify(current));
      } catch {
        /* ignore */
      }
    });
  }, 200);
}

export function getProgress() {
  return current;
}
export function updateProgress(patch: Partial<Progress>) {
  current = { ...current, ...patch };
  bumpStreak();
  persist();
  listeners.forEach((l) => l());
}
export function resetProgress() {
  const keep = { seen_tools: current.seen_tools, counters: current.counters };
  current = { ...structuredCloneSafe(EMPTY), ...keep };
  persist();
  listeners.forEach((l) => l());
}
export function useProgress(): Progress {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

function bumpStreak() {
  if (!current.streak.enabled) return;
  const today = new Date().toISOString().slice(0, 10);
  if (current.streak.last === today) return;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  current.streak = { ...current.streak, count: current.streak.last === y ? current.streak.count + 1 : 1, last: today };
}

/* ---------------- XP, ranks and badges (plan section 12.4) ---------------- */
export const XP = { lesson: 20, first_try: 10, sandbox: 10, track: 100, practice: 150 };
export const RANKS = [
  { min: 0, name: "Trainee" },
  { min: 150, name: "Junior Analyst" },
  { min: 350, name: "Analyst" },
  { min: 600, name: "Senior Analyst" },
  { min: 900, name: "Lead Analyst" },
];
export function totalXp(p: Progress) {
  const missions = Object.values(p.missions).reduce((a, m) => a + m.xp, 0);
  const lessons = Object.values(p.lessons).reduce((a, l) => a + (l.xp || 0), 0);
  return missions + lessons + p.tracks_done.length * XP.track + (p.practice.done ? XP.practice : 0);
}
export function rankFor(xp: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (xp >= x.min) r = x;
  return r;
}
export const BADGES: Record<string, { icon: string; label: string; how: string }> = {
  "First Steps": { icon: "👣", label: "First Steps", how: "Finish your first lesson." },
  "First Hash": { icon: "#️⃣", label: "First Hash", how: "Hash a file in the 'Hashes explained' lesson." },
  "Clean Chain": { icon: "🔗", label: "Clean Chain", how: "Finish the evidence handling track." },
  "Link Maker": { icon: "🕸️", label: "Link Maker", how: "Finish the link analysis lesson." },
  "Time Keeper": { icon: "⏱️", label: "Time Keeper", how: "Finish the timeline and clock offset lessons." },
  "In Scope": { icon: "🧭", label: "In Scope", how: "Finish the procedure and ethics track." },
  "Careful Writer": { icon: "🖋️", label: "Careful Writer", how: "Finish the grading and reporting track." },
  "Straight Answer": { icon: "⚖️", label: "Straight Answer", how: "Pass the fact, inference and assumption check first time." },
  "Explorer": { icon: "🔍", label: "Explorer", how: "Search the help centre for the first time." },
  "Tweaker": { icon: "🎛️", label: "Tweaker", how: "Change ten settings." },
  "Open Eyes": { icon: "👁️", label: "Open Eyes", how: "Finish the OSINT basics track." },
  "Graduate": { icon: "🎓", label: "Graduate", how: "Finish the First Day practice case." },
};
export function award(badge: string) {
  if (current.badges.includes(badge)) return false;
  updateProgress({ badges: [...current.badges, badge] });
  window.dispatchEvent(new CustomEvent("inv:badge", { detail: badge }));
  return true;
}
export function countHelpSearch() {
  updateProgress({ counters: { ...current.counters, help_searches: current.counters.help_searches + 1 } });
  award("Explorer");
}
export function countSettingChange() {
  const n = current.counters.settings_changed + 1;
  updateProgress({ counters: { ...current.counters, settings_changed: n } });
  if (n >= 10) award("Tweaker");
}
/** Cosmetic unlocks: avatar frames and extra accent colours. They change how the profile looks and nothing else. */
export function unlockedFrames(p: Progress): string[] {
  const xp = totalXp(p);
  const f = ["none"];
  if (xp >= 150) f.push("bronze");
  if (xp >= 350) f.push("silver");
  if (xp >= 600) f.push("gold");
  if (p.badges.includes("Graduate")) f.push("graduate");
  return f;
}
