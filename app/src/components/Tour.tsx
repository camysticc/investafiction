import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { playSound } from "../lib/settings";
import { updateProgress, getProgress } from "../lib/progress";

/* A short, skippable spotlight tour of the real case desk. Steps that say "Try it" wait for the
 * real click, so people learn by doing. Each finished step gives a little XP. */

type Step = {
  target: string;
  title: string;
  body: string;
  /** If set, the step waits for a click that satisfies this test. */
  wait?: (el: Element) => boolean;
  waitSelector?: string;
  prefer?: "left" | "right" | "below" | "above";
};

const STEPS: Step[] = [
  { target: ".workspace > .left", title: "Your evidence", body: "Every item in the case is listed here, newest first. Items start as New until you log receipt. Try it: click any item to open it.", waitSelector: ".left .evitem", wait: () => true, prefer: "right" },
  { target: ".tabs", title: "Your toolbox", body: "Search, timeline, link chart, map, web browser, requests and more. Try it: open the Timeline tab.", waitSelector: ".tabs [role=tab]", wait: (el) => /timeline/i.test(el.textContent || ""), prefer: "below" },
  { target: ".side-tabs", title: "Findings and objectives", body: "Objectives say what each stage needs. Findings is where you record what you know, with citations. Try it: open the Findings tab.", waitSelector: ".side-tabs button", wait: (el) => /findings/i.test(el.textContent || ""), prefer: "left" },
  { target: "[data-tour=brief]", title: "Brief and messages", body: "Your case brief and messages from your lead live here. A number appears when something new arrives. The case autosaves as you work.", prefer: "below" },
  { target: ".tabs [role=tab]:last-child", title: "Report and submit", body: "When you have enough, write your report here and submit. In Training mode you can ask for a hint any time; each one costs a few marks.", prefer: "below" },
  { target: "[data-tour=settings]", title: "Make it yours", body: "Settings has dark mode, text size, fonts, accent colours and more. You can replay the Academy from there too. Press the comma key to open it from anywhere.", prefer: "below" },
];

type Rect = { x: number; y: number; w: number; h: number };

export default function Tour() {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [flash, setFlash] = useState(false);
  const step = STEPS[i];
  const done = useRef(false);

  const finish = (how: "done" | "skipped") => {
    if (done.current) return;
    done.current = true;
    updateProgress({ tour: how });
  };
  const next = (earned: boolean) => {
    if (earned) {
      const p = getProgress();
      updateProgress({ missions: { ...p.missions, [`tour-${i}`]: { xp: 5, flawless: true } } });
      playSound("good");
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    }
    if (i + 1 >= STEPS.length) finish("done");
    else setI(i + 1);
  };

  // follow the target element
  useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((o) => (o && Math.abs(o.x - r.left) < 0.5 && Math.abs(o.y - r.top) < 0.5 && Math.abs(o.w - r.width) < 0.5 && Math.abs(o.h - r.height) < 0.5 ? o : { x: r.left, y: r.top, w: r.width, h: r.height }));
      } else setRect(null);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  // wait for the real click
  useEffect(() => {
    if (!step.waitSelector) return;
    const h = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest(step.waitSelector!);
      if (el && step.wait!(el)) setTimeout(() => next(true), 250);
    };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [i]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && finish("skipped");
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const vw = window.innerWidth, vh = window.innerHeight;
  const cardW = 330;
  let cx = vw / 2 - cardW / 2, cy = vh / 2 - 90;
  if (rect) {
    const pad = 12;
    const pref = step.prefer ?? "below";
    const fitsBelow = rect.y + rect.h + 190 < vh;
    if (pref === "right" && rect.x + rect.w + cardW + pad < vw) { cx = rect.x + rect.w + pad; cy = Math.min(Math.max(rect.y + 60, 10), vh - 230); }
    else if (pref === "left" && rect.x - cardW - pad > 0) { cx = rect.x - cardW - pad; cy = Math.min(Math.max(rect.y + 60, 10), vh - 230); }
    else if (fitsBelow) { cx = Math.min(Math.max(rect.x + rect.w / 2 - cardW / 2, 10), vw - cardW - 10); cy = rect.y + rect.h + pad; }
    else { cx = Math.min(Math.max(rect.x + rect.w / 2 - cardW / 2, 10), vw - cardW - 10); cy = Math.max(10, rect.y - 200); }
  }
  const interactive = !!step.waitSelector;

  return (
    <div className="tour" aria-live="polite">
      {rect ? <div className="tour-hole" style={{ left: rect.x - 4, top: rect.y - 4, width: rect.w + 8, height: rect.h + 8 }} /> : <div className="tour-dim" />}
      <div className="tour-card" style={{ left: cx, top: cy, width: cardW }} role="dialog" aria-label="Guided tour">
        <div className="tour-top">
          <span className="ac-kicker">Tour {i + 1} of {STEPS.length}</span>
          {flash && <span className="xp-pop">+5 XP</span>}
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-dots">{STEPS.map((_, k) => <span key={k} className={k === i ? "on" : k < i ? "past" : ""} />)}</div>
        <div className="row-end" style={{ justifyContent: "space-between" }}>
          <button className="ghost" onClick={() => finish("skipped")}>Skip tour</button>
          {interactive ? (
            <button className="ghost" onClick={() => next(false)}>Skip this step</button>
          ) : (
            <button className="primary" onClick={() => next(false)}>{i + 1 === STEPS.length ? "Finish" : "Next"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
