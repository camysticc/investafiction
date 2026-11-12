/* Keyboard shortcuts: about forty actions, three presets, and per-action
 * rebinding stored with the settings (shortcut_map). */
import { get, getAll, setMany } from "./settings";

export type Action = { id: string; label: string; group: string };
export const ACTIONS: Action[] = [
  { id: "area.library", label: "Go to the case library", group: "Areas" },
  { id: "area.workspace", label: "Go to the open case", group: "Areas" },
  { id: "area.academy", label: "Go to the Academy", group: "Areas" },
  { id: "area.progress", label: "Go to your progress", group: "Areas" },
  { id: "area.settings", label: "Open settings", group: "Areas" },
  { id: "area.help", label: "Open the help centre", group: "Areas" },
  { id: "area.profile", label: "Go to your profile", group: "Areas" },
  { id: "tab.viewer", label: "Evidence viewer tab", group: "Case tabs" },
  { id: "tab.search", label: "Search tab", group: "Case tabs" },
  { id: "tab.statements", label: "Statements tab", group: "Case tabs" },
  { id: "tab.timeline", label: "Timeline tab", group: "Case tabs" },
  { id: "tab.links", label: "Link chart tab", group: "Case tabs" },
  { id: "tab.map", label: "Map tab", group: "Case tabs" },
  { id: "tab.browser", label: "Web browser tab", group: "Case tabs" },
  { id: "tab.requests", label: "Requests tab", group: "Case tabs" },
  { id: "tab.integrity", label: "Integrity tab", group: "Case tabs" },
  { id: "tab.report", label: "Report tab", group: "Case tabs" },
  { id: "tab.debrief", label: "Debrief tab", group: "Case tabs" },
  { id: "side.objectives", label: "Objectives panel", group: "Side panel" },
  { id: "side.findings", label: "Findings panel", group: "Side panel" },
  { id: "side.notes", label: "Notes panel", group: "Side panel" },
  { id: "side.log", label: "Action log panel", group: "Side panel" },
  { id: "ev.next", label: "Next evidence item", group: "Evidence" },
  { id: "ev.prev", label: "Previous evidence item", group: "Evidence" },
  { id: "ev.log_receipt", label: "Log receipt of the selected item", group: "Evidence" },
  { id: "ev.hash", label: "Check the hash of the selected item", group: "Evidence" },
  { id: "ev.log_all", label: "Log receipt of every item", group: "Evidence" },
  { id: "ev.hash_all", label: "Hash every item", group: "Evidence" },
  { id: "ev.examine", label: "Examine a working copy", group: "Evidence" },
  { id: "ev.filter", label: "Jump to the evidence filter", group: "Evidence" },
  { id: "case.save", label: "Save now", group: "Case" },
  { id: "case.brief", label: "Open the brief and messages", group: "Case" },
  { id: "case.hint", label: "Show the objectives to ask for a hint", group: "Case" },
  { id: "case.new_finding", label: "Start a new finding", group: "Case" },
  { id: "case.add_event", label: "Add a timeline event", group: "Case" },
  { id: "case.leave", label: "Save and return to the library", group: "Case" },
  { id: "ui.what_is_this", label: "'What is this?' mode", group: "Interface" },
  { id: "ui.shortcut_sheet", label: "Show the shortcut sheet", group: "Interface" },
  { id: "ui.text_bigger", label: "Larger text", group: "Interface" },
  { id: "ui.text_smaller", label: "Smaller text", group: "Interface" },
  { id: "ui.toggle_theme", label: "Switch between light and dark", group: "Interface" },
];

const DEFAULT: Record<string, string> = {
  "area.library": "Alt+1", "area.workspace": "Alt+2", "area.academy": "Alt+3", "area.progress": "Alt+4", "area.settings": ",", "area.help": "F1", "area.profile": "Alt+7",
  "tab.viewer": "Alt+V", "tab.search": "Alt+S", "tab.statements": "Alt+C", "tab.timeline": "Alt+T", "tab.links": "Alt+K", "tab.map": "Alt+M",
  "tab.browser": "Alt+W", "tab.requests": "Alt+Q", "tab.integrity": "Alt+I", "tab.report": "Alt+R", "tab.debrief": "Alt+D",
  "side.objectives": "Alt+O", "side.findings": "Alt+F", "side.notes": "Alt+N", "side.log": "Alt+L",
  "ev.next": "J", "ev.prev": "K", "ev.log_receipt": "Shift+R", "ev.hash": "Shift+H", "ev.log_all": "Ctrl+Shift+R", "ev.hash_all": "Ctrl+Shift+H", "ev.examine": "E", "ev.filter": "/",
  "case.save": "Ctrl+S", "case.brief": "Alt+B", "case.hint": "Alt+H", "case.new_finding": "Alt+Shift+F", "case.add_event": "Alt+Shift+T", "case.leave": "Alt+Shift+L",
  "ui.what_is_this": "Shift+F1", "ui.shortcut_sheet": "Ctrl+/", "ui.text_bigger": "Ctrl+=", "ui.text_smaller": "Ctrl+-", "ui.toggle_theme": "Alt+Shift+D",
};
const COMPACT: Record<string, string> = {
  ...DEFAULT,
  "tab.viewer": "1", "tab.search": "2", "tab.statements": "3", "tab.timeline": "4", "tab.links": "5", "tab.map": "6",
  "tab.browser": "7", "tab.requests": "8", "tab.integrity": "9", "tab.report": "0", "case.brief": "B", "case.hint": "H",
};
const MOUSE_FREE: Record<string, string> = {
  ...DEFAULT,
  "ev.next": "ArrowDown", "ev.prev": "ArrowUp", "ev.examine": "Enter", "ev.log_receipt": "R", "ev.hash": "H", "case.new_finding": "N", "case.add_event": "T",
};
export const PRESETS: Record<string, Record<string, string>> = { default: DEFAULT, compact: COMPACT, mouse_free: MOUSE_FREE };

export function bindings(): Record<string, string> {
  const base = PRESETS[get<string>("shortcuts.shortcut_preset")] ?? DEFAULT;
  const custom = (getAll().shortcut_map ?? {}) as Record<string, string>;
  return { ...base, ...custom };
}
export function rebind(action: string, combo: string) {
  const custom = { ...((getAll().shortcut_map ?? {}) as Record<string, string>) };
  for (const [k, v] of Object.entries(custom)) if (v === combo && k !== action) delete custom[k];
  custom[action] = combo;
  setMany({ shortcut_map: custom, "shortcuts.rebind_actions": "custom" });
}
export function resetShortcuts() {
  setMany({ shortcut_map: {}, "shortcuts.rebind_actions": "default" });
}
export function comboOf(e: KeyboardEvent): string {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  const shiftedSymbol = key.length === 1 && !/[A-Z0-9]/.test(key);
  if (e.shiftKey && !shiftedSymbol) parts.push("Shift");
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return parts.join("+");
  // Alt with a digit or letter: use the physical key so layouts agree
  if (e.altKey && e.code?.startsWith("Digit")) key = e.code.slice(5);
  if (e.altKey && e.code?.startsWith("Key")) key = e.code.slice(3);
  parts.push(key);
  return parts.join("+");
}
export function actionFor(combo: string): string | null {
  const b = bindings();
  for (const [k, v] of Object.entries(b)) if (v.toUpperCase() === combo.toUpperCase()) return k;
  return null;
}
export function keyFor(action: string): string {
  return bindings()[action] ?? "";
}
