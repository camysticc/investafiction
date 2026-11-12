/* The Academy sandbox: a separate training attempt on the First Day pack with
 * every stage open, plus a task checklist that watches the real tools. */
import { useSyncExternalStore } from "react";
import { call, isDesktop } from "../lib/api";
import type { GameState } from "../lib/types";
import type { Lesson, Step } from "./content";

type SB = { lesson: Lesson | null; done: boolean[]; side: string; searched: boolean; finished: boolean };
let state: SB = { lesson: null, done: [], side: "objectives", searched: false, finished: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function useSandbox() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}
export const sandboxActive = () => !!state.lesson;
export function setSandbox(p: Partial<SB>) {
  state = { ...state, ...p };
  emit();
}
window.addEventListener("inv:side", (e) => setSandbox({ side: (e as CustomEvent).detail }));
window.addEventListener("inv:searched", () => setSandbox({ searched: true }));

const PACK = "first-day";
let sandboxAttempt: string | null = localStorage.getItem("inv.sandbox.attempt");
let practiceAttempt: string | null = localStorage.getItem("inv.practice.attempt");
export const isSandboxAttempt = (id?: string | null) => !!id && id === sandboxAttempt;
export const isPracticeAttempt = (id?: string | null) => !!id && id === practiceAttempt;

/** Make sure the training pack is in the library. It ships inside the program. */
export async function ensurePack() {
  const lib = await call("library.list");
  if (lib.cases.some((c: any) => c.id === PACK)) return;
  const res = await fetch("/packs/first-day.invcase");
  if (!res.ok) throw new Error("The training pack is missing from this build.");
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const r = await call("pack.inspect", { data_b64: btoa(bin) });
  await call("pack.install", { token: r.token });
  void isDesktop;
}

export async function openSandbox(lesson: Lesson, fresh = false): Promise<GameState> {
  await ensurePack();
  let st: GameState | null = null;
  if (sandboxAttempt && !fresh) {
    try {
      st = await call("attempt.open", { case_id: PACK, attempt_id: sandboxAttempt });
      if (st!.attempt.submitted) st = null;
    } catch {
      st = null;
    }
  }
  if (!st) {
    const r = await call("attempt.new", { case_id: PACK, mode: "training", hints_available: 3, warnings: true });
    sandboxAttempt = r.attempt_id;
    localStorage.setItem("inv.sandbox.attempt", r.attempt_id);
    await call("attempt.open", { case_id: PACK, attempt_id: r.attempt_id });
    st = (await call("act", { type: "open_all_stages" })).state;
  }
  setSandbox({ lesson, done: lesson.sandbox!.steps.map(() => false), searched: false, finished: false, side: "objectives" });
  return st!;
}

export async function startPractice(): Promise<GameState> {
  await ensurePack();
  const r = await call("attempt.new", { case_id: PACK, mode: "training", hints_available: 3, warnings: true });
  practiceAttempt = r.attempt_id;
  localStorage.setItem("inv.practice.attempt", r.attempt_id);
  return call("attempt.open", { case_id: PACK, attempt_id: r.attempt_id });
}
export async function resumePractice(): Promise<GameState | null> {
  if (!practiceAttempt) return null;
  try {
    return await call("attempt.open", { case_id: PACK, attempt_id: practiceAttempt });
  } catch {
    return null;
  }
}

/** Is one sandbox step satisfied by the current state? */
export function stepDone(step: Step, g: GameState, tab: string): boolean {
  const c = step.check;
  const a = g.attempt;
  const ev = g.case.evidence;
  const ids: string[] = c.ids ?? [];
  switch (c.kind) {
    case "tab": return tab === c.tab;
    case "side": return state.side === c.panel;
    case "searched": return state.searched;
    case "received": return c.all ? ev.every((e) => e.received) : ids.every((i) => ev.find((e) => e.id === i)?.received);
    case "examined": return c.min ? ev.filter((e) => e.examined).length >= c.min : ids.every((i) => ev.find((e) => e.id === i)?.examined);
    case "hashed": return c.all ? ev.every((e) => e.hashed) : ids.every((i) => ev.find((e) => e.id === i)?.hashed);
    case "integrity_report": return ids.every((i) => i in a.integrity_reports);
    case "finding": return a.findings.filter((f) => (!c.cited || f.evidence.length > 0) && (!c.type || f.type === c.type)).length >= (c.min ?? 1);
    case "timeline": return a.timeline.length >= (c.min ?? 1);
    case "timeline_at": {
      const target = Date.parse(c.time.replace(" ", "T") + "Z");
      return a.timeline.some((e) => Math.abs(Date.parse(e.time.replace(" ", "T").replace(/Z?$/, "Z")) - target) <= (c.tolerance ?? 2) * 60000 && (!c.evidence || e.evidence.includes(c.evidence)));
    }
    case "link": return a.links.filter((l) => !c.cited || l.evidence.length > 0).length >= (c.min ?? 1);
    case "pins": return (a.pins ?? []).length >= (c.min ?? 1);
    case "claim_link": return (a.claim_links ?? []).some((l) => (c.relation === "evidence" ? l.relation === "supports" || l.relation === "contradicts" : l.relation === c.relation));
    case "captured": return (c.pages ?? []).every((p: string) => a.captures.some((x) => x.page === p && x.method === "full"));
    case "page_viewed": return (c.pages ?? []).every((p: string) => (a.page_views[p] ?? 0) > 0);
    case "graded": return ev.filter((e) => e.grade).length + a.findings.filter((f) => f.grade).length >= (c.min ?? 1);
    case "report_section": return ((a.report as any)[c.section] ?? "").trim().split(/\s+/).filter(Boolean).length >= (c.words ?? 1);
    case "legality": return a.report.legality.signed;
    case "request": return a.requests.some((r) => r.granted === (c.granted ?? true));
    default: return false;
  }
}
