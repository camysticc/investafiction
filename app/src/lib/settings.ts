/* Settings, driven entirely by content/settings.schema.json.
 *
 * The schema is the single source of truth: it generates the settings screen,
 * the defaults, the validation of the saved file, settings search and the
 * settings articles in the help centre. Values are kept in one small local
 * file through the core (store "settings"), with a version number. A damaged
 * file falls back to the defaults and never touches case saves. */
import { useSyncExternalStore } from "react";
import schemaJson from "../content/settings.schema.json";
import { call } from "./api";

export type Option = { value: string; label: string };
export type SettingDef = {
  id: string;
  category: string;
  label: string;
  description: string;
  type: "choice" | "toggle" | "range" | "button" | "locked" | "profile_name" | "shortcuts";
  options?: Option[];
  labels?: [string, string];
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  affects_score: boolean;
  locked: boolean;
  locked_reason?: string;
  essential: boolean;
  note?: string;
  confirm?: boolean;
  action?: string;
  value?: string;
};
export type Category = { id: string; label: string; description: string };
export type Preset = { id: string; label: string; description: string; values: Record<string, any> };
export const SCHEMA = schemaJson as unknown as { version: number; categories: Category[]; settings: SettingDef[]; presets: Preset[] };
export const DEFS: Record<string, SettingDef> = Object.fromEntries(SCHEMA.settings.map((s) => [s.id, s]));

export type Values = Record<string, any>;

function hasValue(d: SettingDef) {
  return d.type === "choice" || d.type === "toggle" || d.type === "range" || d.type === "shortcuts";
}

export const DEFAULTS: Values = Object.fromEntries(SCHEMA.settings.filter(hasValue).map((d) => [d.id, d.default]));

/** Keep only known settings with valid values. Everything else is dropped. */
export function sanitise(raw: unknown): { values: Values; dropped: number } {
  const out: Values = { ...DEFAULTS };
  let dropped = 0;
  if (!raw || typeof raw !== "object") return { values: out, dropped: 0 };
  for (const [k, v] of Object.entries(raw as Values)) {
    const d = DEFS[k];
    if (!d || !hasValue(d)) {
      if (k !== "shortcut_map") dropped++;
      continue;
    }
    if (d.type === "toggle" && typeof v === "boolean") out[k] = v;
    else if (d.type === "choice" && d.options!.some((o) => o.value === v)) out[k] = v;
    else if (d.type === "range" && typeof v === "number" && v >= d.min! && v <= d.max!) out[k] = v;
    else if (d.type === "shortcuts" && typeof v === "string") out[k] = v;
    else dropped++;
  }
  const sm = (raw as Values).shortcut_map;
  if (sm && typeof sm === "object") out.shortcut_map = sm;
  return { values: out, dropped };
}

const listeners = new Set<() => void>();
let current: Values = { ...DEFAULTS };
let loadedFromFile = false;
let damaged = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let changedCount = 0;

export function get<T = any>(id: string): T {
  return (id in current ? current[id] : DEFAULTS[id]) as T;
}
export function getAll(): Values {
  return current;
}
export function settingsDamaged() {
  return damaged;
}
export function changedFromDefault(): string[] {
  return Object.keys(DEFAULTS).filter((k) => JSON.stringify(current[k]) !== JSON.stringify(DEFAULTS[k]));
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    call("store.set", { name: "settings", data: current }).catch(() => {
      try {
        localStorage.setItem("investafiction.settings.v2", JSON.stringify(current));
      } catch {
        /* nowhere to save; settings still apply for this session */
      }
    });
  }, 250);
}

function emit() {
  applySettings();
  listeners.forEach((l) => l());
}

export function set(id: string, value: any) {
  const d = DEFS[id];
  if (!d || d.locked) return;
  current = { ...current, [id]: value };
  changedCount++;
  persist();
  emit();
  window.dispatchEvent(new CustomEvent("inv:setting", { detail: { id, value, changedCount } }));
}

export function setMany(values: Values) {
  current = { ...current, ...sanitise({ ...current, ...values }).values };
  persist();
  emit();
}

export function resetOne(id: string) {
  set(id, DEFAULTS[id]);
}
export function resetCategory(cat: string) {
  const v: Values = {};
  for (const d of SCHEMA.settings) if (d.category === cat && hasValue(d)) v[d.id] = DEFAULTS[d.id];
  setMany(v);
}
export function resetAll() {
  const keep = current.shortcut_map;
  current = { ...DEFAULTS };
  if (keep && false) current.shortcut_map = keep;
  persist();
  emit();
}
export function applyPreset(id: string) {
  const p = SCHEMA.presets.find((x) => x.id === id);
  if (!p) return;
  current = { ...DEFAULTS, shortcut_map: current.shortcut_map };
  setMany(p.values);
}
export function exportSettings(): string {
  return JSON.stringify({ app: "Investafiction", kind: "settings", version: SCHEMA.version, values: current }, null, 1);
}
export function importSettings(text: string): { ok: boolean; dropped: number; message?: string } {
  try {
    const j = JSON.parse(text);
    if (j?.kind !== "settings" || !j.values) return { ok: false, dropped: 0, message: "That file is not an Investafiction settings export." };
    const { values, dropped } = sanitise(j.values);
    current = values;
    persist();
    emit();
    return { ok: true, dropped };
  } catch {
    return { ok: false, dropped: 0, message: "The file could not be read." };
  }
}

/** Load saved settings during start-up. */
export async function loadSettings(): Promise<{ damaged: boolean }> {
  try {
    const r = await call<{ data: unknown; damaged: boolean }>("store.get", { name: "settings" });
    let raw = r.data;
    if (!raw) {
      try {
        raw = JSON.parse(localStorage.getItem("investafiction.settings.v2") || "null");
      } catch {
        raw = null;
      }
    }
    current = sanitise(raw).values;
    damaged = !!r.damaged;
  } catch {
    current = { ...DEFAULTS };
  }
  loadedFromFile = true;
  emit();
  return { damaged };
}
export const isLoaded = () => loadedFromFile;

export function useSettings(): Values {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
export function useSetting<T = any>(id: string): T {
  const all = useSettings();
  return (id in all ? all[id] : DEFAULTS[id]) as T;
}

const media = (q: string) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q) : null);

export function resolvedTheme(): "light" | "dark" {
  const t = get<string>("appearance.theme");
  if (t === "match_my_computer") return media("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  if (t === "high_contrast") return "dark";
  return t === "light" ? "light" : "dark";
}

const TEXT_SIZE: Record<string, number> = { small: 0.9, medium: 1, large: 1.15, extra_large: 1.3, huge: 1.5 };

/** Push the visual settings onto the page as data attributes and variables. */
export function applySettings() {
  const el = document.documentElement;
  const ds = el.dataset;
  ds.theme = resolvedTheme();
  ds.contrast = get("appearance.theme") === "high_contrast" ? "high" : "normal";
  ds.accent = get("appearance.accent_colour");
  ds.font = { standard: "default", dyslexia_friendly: "easy", monospace_for_data_tables: "datamono" }[get<string>("appearance.font")] ?? "default";
  ds.lh = get("appearance.line_spacing");
  ds.density = get("appearance.layout_density") === "comfortable" ? "normal" : get("appearance.layout_density");
  ds.corners = get("appearance.corner_style");
  ds.icons = get("appearance.icon_style");
  ds.arrange = get("appearance.panel_arrangement");
  ds.motion = get("accessibility.reduce_motion") || media("(prefers-reduced-motion: reduce)")?.matches ? "reduced" : "full";
  ds.transp = get("accessibility.reduce_transparency") ? "off" : "on";
  ds.hcev = get("accessibility.high_contrast_evidence_viewers") ? "on" : "off";
  ds.cb = { none: "off", red_and_green: "on", blue_and_yellow: "tritan", monochrome: "mono" }[get<string>("accessibility.colour_blind_safe_palette")] ?? "off";
  ds.focus = get("accessibility.focus_outline_thickness");
  ds.targets = get("accessibility.large_click_targets") ? "large" : "normal";
  ds.ul = get("accessibility.underline_links") ? "on" : "off";
  ds.strong = get("accessibility.strengthen_graph_and_timeline_lines") ? "on" : "off";
  ds.noflash = get("accessibility.avoid_flashing_effects") ? "on" : "off";
  ds.kbdhints = get("accessibility.show_shortcut_hints_on_buttons") ? "on" : "off";
  ds.clock = get("gameplay.case_clock") === "hidden" ? "off" : "on";
  ds.wrap = get("viewers.wrap_long_text") ? "on" : "off";
  ds.rownums = get("viewers.show_row_numbers") ? "on" : "off";
  ds.hl = get("search.result_highlight_colour");
  ds.notesize = get("notes.note_font_size");
  ds.examined = get("viewers.mark_examined_items");
  ds.internalids = get("advanced.show_internal_ids_on_items") ? "on" : "off";
  ds.newev = get("gameplay.highlight_new_evidence") ? "on" : "off";
  ds.helpicons = get("academy.contextual_help_icons") ? "on" : "off";
  el.style.fontSize = `${15 * (TEXT_SIZE[get<string>("appearance.text_size")] ?? 1)}px`;
  (el.style as any).zoom = String((get<number>("appearance.interface_zoom") ?? 100) / 100);
}

export function initSettings() {
  applySettings();
  media("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => applySettings());
  media("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", () => applySettings());
}

/* ---------------- formatting that follows General settings ---------------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDateParts(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0"), mm = String(d.getUTCMonth() + 1).padStart(2, "0"), yy = d.getUTCFullYear();
  switch (get<string>("general.date_format")) {
    case "yyyy_mm_dd": return `${yy}-${mm}-${dd}`;
    case "d_mon_yyyy": return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${yy}`;
    default: return `${dd}/${mm}/${yy}`;
  }
}
export function fmtClock(d: Date): string {
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
  if (get<string>("general.time_format") === "12_hour") return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}`;
  return `${String(h).padStart(2, "0")}:${m}`;
}
export function fmtNumber(n: number, digits = 2): string {
  const s = n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return get<string>("general.number_format") === "space_comma" ? s.replace(/,/g, " ").replace(/\.(\d+)$/, ",$1") : s;
}
export function fmtMoney(n: number): string {
  return get<string>("general.currency_display") === "code" ? `GBP ${fmtNumber(n)}` : `£${fmtNumber(n)}`;
}

/* ---------------- sound ---------------- */
let ctx: AudioContext | null = null;
export type SoundKind = "good" | "bad" | "level" | "click" | "chime" | "warning";
export function playSound(kind: SoundKind) {
  const vol = (get<number>("sound.master_volume") ?? 60) / 100;
  if (vol <= 0) return;
  if (get("sound.mute_when_the_window_is_not_in_focus") && !document.hasFocus()) return;
  if (kind === "click" && !get("sound.interface_sounds")) return;
  if (kind === "chime" && !get("sound.stage_unlock_chime")) return;
  if (kind === "warning" && !get("sound.warning_sound")) return;
  if ((kind === "good" || kind === "bad" || kind === "level") && !get("sound.academy_reward_sounds")) return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const pack = get<string>("sound.sound_pack");
    const notes: Record<SoundKind, number[]> = { good: [660, 880], bad: [220, 180], level: [523, 659, 784, 1047], click: [440], chime: [784, 988, 1175], warning: [330, 262] };
    const wave: OscillatorType = pack === "classic" ? "triangle" : pack === "minimal" ? "sine" : kind === "bad" ? "sawtooth" : "sine";
    const seq = pack === "minimal" ? notes[kind].slice(0, 1) : notes[kind];
    const peak = (pack === "quiet" ? 0.05 : 0.08) * vol;
    const t0 = ctx!.currentTime;
    seq.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = wave;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 0.18);
    });
  } catch {
    /* sound is optional */
  }
}
