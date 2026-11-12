import { useSyncExternalStore } from "react";

export type Settings = {
  theme: "light" | "dark" | "system";
  accent: "blue" | "teal" | "green" | "purple" | "rose" | "amber";
  font: "default" | "serif" | "easy" | "mono";
  lineSpacing: "tight" | "normal" | "relaxed";
  density: "compact" | "comfortable" | "spacious";
  panels: "narrow" | "normal" | "wide";
  motion: "system" | "full" | "reduced";
  contrast: "normal" | "high";
  colourBlind: boolean;
  showClock: boolean;
  sound: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "blue",
  font: "default",
  lineSpacing: "normal",
  density: "comfortable",
  panels: "normal",
  motion: "system",
  contrast: "normal",
  colourBlind: false,
  showClock: true,
  sound: true,
};

const KEY = "investafiction.settings.v1";
const listeners = new Set<() => void>();
let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage can be unavailable; fall back to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

const media = (q: string) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q) : null);

export function resolvedTheme(s: Settings = current): "light" | "dark" {
  if (s.theme === "system") return media("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  return s.theme;
}

export function applySettings(s: Settings = current) {
  const el = document.documentElement;
  el.dataset.theme = resolvedTheme(s);
  el.dataset.accent = s.accent;
  el.dataset.font = s.font;
  el.dataset.lh = s.lineSpacing;
  el.dataset.density = s.density === "comfortable" ? "normal" : s.density;
  el.dataset.panels = s.panels;
  el.dataset.motion = s.motion === "system" ? (media("(prefers-reduced-motion: reduce)")?.matches ? "reduced" : "full") : s.motion;
  el.dataset.contrast = s.contrast;
  el.dataset.cb = s.colourBlind ? "on" : "off";
  el.dataset.clock = s.showClock ? "on" : "off";
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  applySettings(current);
  listeners.forEach((l) => l());
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS });
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Call once at start-up: applies saved settings and follows the system theme and motion settings. */
export function initSettings() {
  applySettings(current);
  media("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => current.theme === "system" && applySettings(current));
  media("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", () => current.motion === "system" && applySettings(current));
}

/** Short, quiet sound effects made with the Web Audio API (no files, no network). */
let ctx: AudioContext | null = null;
export function playSound(kind: "good" | "bad" | "level" | "click") {
  if (!current.sound) return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const notes: Record<string, number[]> = { good: [660, 880], bad: [220, 180], level: [523, 659, 784, 1047], click: [440] };
    const t0 = ctx!.currentTime;
    notes[kind].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = kind === "bad" ? "sawtooth" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 0.18);
    });
  } catch {
    /* sound is optional */
  }
}
