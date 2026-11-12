/* Loads the Academy lesson files (one per track) from content/academy. */
import index from "../content/academy/index.json";

export type Check = { q: string; options: string[]; answer: number; hint: string };
export type Step = { label: string; check: Record<string, any> };
export type Lesson = {
  id: string; title: string; minutes: number; picture: string; intro: string;
  tryit: Record<string, any>;
  sandbox?: { task: string; tab: string; select?: string; badge_on_done?: string | null; steps: Step[] };
  check: Check[]; learn_more: string;
};
export type Track = { id: string; n: number; title: string; icon: string; badge: string | null; practice: string; lessons: Lesson[] };

const files = import.meta.glob("../content/academy/*-*.json", { eager: true }) as Record<string, { default: Track }>;
export const TRACKS: Track[] = (index as { tracks: { id: string; file: string }[] }).tracks.map((t) => {
  const key = Object.keys(files).find((k) => k.endsWith("/" + t.file))!;
  return (files[key] as any).default ?? (files[key] as any);
});
export const LESSONS: Lesson[] = TRACKS.flatMap((t) => t.lessons);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id) ?? null;
export const trackOf = (id: string) => TRACKS.find((t) => t.lessons.some((l) => l.id === id)) ?? null;
/** Which lesson teaches each workspace tool, for the first-time prompts. */
export const TOOL_LESSON: Record<string, string> = {
  timeline: "analysis.timeline", links: "analysis.links", map: "analysis.map", browser: "osint.capture", requests: "procedure.requests",
  integrity: "evidence.hashes", report: "reporting.report", search: "gs.search", statements: "analysis.fia",
};
