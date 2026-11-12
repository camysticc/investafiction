import { useSyncExternalStore } from "react";

/** Training progress. Stored only on this computer, in the app's local storage. */
export type Progress = {
  academy: "new" | "skipped" | "started" | "done";
  missions: Record<string, { xp: number; flawless: boolean }>;
  badges: string[];
  tour: "new" | "skipped" | "done";
};

const KEY = "investafiction.progress.v1";
const EMPTY: Progress = { academy: "new", missions: {}, badges: [], tour: "new" };
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...EMPTY, missions: {}, badges: [] };
}
let current = load();

export function getProgress() {
  return current;
}
export function updateProgress(patch: Partial<Progress>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
export function resetProgress() {
  updateProgress({ academy: "new", missions: {}, badges: [], tour: "new" });
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

export const RANKS = [
  { min: 0, name: "Trainee" },
  { min: 35, name: "Junior Analyst" },
  { min: 80, name: "Analyst" },
  { min: 120, name: "Senior Analyst" },
  { min: 165, name: "Lead Investigator" },
];
export function totalXp(p: Progress) {
  return Object.values(p.missions).reduce((a, m) => a + m.xp, 0);
}
export function rankFor(xp: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (xp >= x.min) r = x;
  return r;
}
