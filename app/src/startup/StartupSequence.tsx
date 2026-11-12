/* Start-up sequence. Runs on every launch, in the same order, and cannot be
 * skipped: a simple mock computer screen, opening the program, a welcome by
 * the chosen name, then a loading screen that does the real start-up work.
 *
 * Rules (plan section 4.1): it belongs to start-up only and nothing else in
 * the program refers to it; it is drawn entirely by the program and reads
 * nothing from the real computer; its look is original and generic; it lives
 * in this folder so it can be changed or removed without touching anything
 * else; it follows the reduced motion setting and works with the keyboard
 * and screen readers. */
import { useEffect, useRef, useState } from "react";
import "./startup.css";

export type StartupWork = { label: string; run: () => Promise<unknown> }[];

type Props = { name: string; reducedMotion: boolean; work: StartupWork; onDone: () => void };

const DECOR = [
  { id: "docs", label: "Documents", glyph: "▤" },
  { id: "calc", label: "Calculator", glyph: "▦" },
  { id: "music", label: "Music", glyph: "♪" },
  { id: "photos", label: "Photos", glyph: "◩" },
  { id: "bin", label: "Bin", glyph: "⌫" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(h);
  }, []);
  return now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function StartupSequence({ name, reducedMotion, work, onDone }: Props) {
  const [step, setStep] = useState<"desktop" | "opening" | "welcome" | "loading">("desktop");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Starting");
  const [announce, setAnnounce] = useState("Desktop. Open Investafiction to begin.");
  const iconRef = useRef<HTMLButtonElement>(null);
  const clock = useClock();
  const welcomeMs = reducedMotion ? 900 : 2000;
  const minLoadMs = reducedMotion ? 1500 : 5000;

  useEffect(() => {
    iconRef.current?.focus();
  }, []);

  const open = () => {
    if (step !== "desktop") return;
    setStep("opening");
    setAnnounce("Opening Investafiction.");
    setTimeout(() => {
      setStep("welcome");
      setAnnounce(`Welcome, ${name}.`);
    }, reducedMotion ? 120 : 650);
  };

  useEffect(() => {
    if (step !== "welcome") return;
    const h = setTimeout(() => setStep("loading"), welcomeMs);
    return () => clearTimeout(h);
  }, [step]);

  useEffect(() => {
    if (step !== "loading") return;
    let cancelled = false;
    const t0 = performance.now();
    (async () => {
      const lines = [...work.map((w) => w.label), "Preparing the workspace"];
      for (let i = 0; i < work.length; i++) {
        if (cancelled) return;
        setStatus(lines[i]);
        setAnnounce(lines[i]);
        try {
          await work[i].run();
        } catch {
          /* each step reports its own problems once the program is open */
        }
        // keep the bar honest: real work fills it, the pacing only stretches it
        const share = (i + 1) / (work.length + 1);
        const elapsedShare = Math.min(1, (performance.now() - t0) / minLoadMs);
        setProgress(Math.round(100 * Math.min(share, Math.max(elapsedShare, share * 0.6))));
        const target = (minLoadMs * (i + 1)) / (work.length + 1);
        const wait = target - (performance.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        setProgress(Math.round(100 * share));
      }
      if (cancelled) return;
      setStatus(lines[lines.length - 1]);
      const rest = minLoadMs - (performance.now() - t0);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
      setProgress(100);
      setAnnounce("Ready.");
      await new Promise((r) => setTimeout(r, reducedMotion ? 80 : 350));
      if (!cancelled) onDone();
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  return (
    <div className={`su-root ${reducedMotion ? "su-reduced" : ""}`}>
      <div className="su-sr" role="status" aria-live="polite">{announce}</div>
      {(step === "desktop" || step === "opening") && (
        <div className={`su-desktop ${step === "opening" ? "su-opening" : ""}`} onClick={() => setSelected(null)}>
          <div className="su-wallpaper" aria-hidden="true">
            <span className="su-blob a" /><span className="su-blob b" /><span className="su-blob c" />
          </div>
          <div className="su-icons" role="group" aria-label="Desktop icons">
            <button
              ref={iconRef}
              className={`su-icon su-main ${selected === "inv" ? "sel" : ""}`}
              aria-label="Investafiction. Double click or press Enter to open."
              onClick={(e) => { e.stopPropagation(); setSelected("inv"); setNote(null); }}
              onDoubleClick={(e) => { e.stopPropagation(); open(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
            >
              <img src="/icon.svg" alt="" width={44} height={44} />
              <span>Investafiction</span>
            </button>
            {DECOR.map((d) => (
              <button
                key={d.id}
                className={`su-icon ${selected === d.id ? "sel" : ""}`}
                aria-label={`${d.label}. Not available in this simulation.`}
                onClick={(e) => { e.stopPropagation(); setSelected(d.id); setNote(`${d.label} is not available in this simulation.`); }}
                onDoubleClick={(e) => { e.stopPropagation(); setNote(`${d.label} is not available in this simulation.`); }}
              >
                <span className="su-glyph" aria-hidden="true">{d.glyph}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
          {note && <div className="su-note" role="alert">{note}</div>}
          <div className="su-hint" aria-hidden="true">Double click Investafiction to open it</div>
          <div className="su-taskbar">
            <span className="su-start" aria-hidden="true">◐</span>
            <span className="su-task" aria-hidden="true">{step === "opening" ? "Investafiction" : ""}</span>
            <span className="su-clock" aria-label={`Time ${clock}`}>{clock}</span>
          </div>
        </div>
      )}
      {step === "welcome" && (
        <div className="su-welcome">
          <img src="/icon.svg" alt="" width={72} height={72} />
          <h1>Welcome, {name}</h1>
        </div>
      )}
      {step === "loading" && (
        <div className="su-loading">
          <img src="/icon.svg" alt="" width={48} height={48} />
          <h2>Investafiction</h2>
          <div className="su-bar" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <p className="su-status">{status}…</p>
        </div>
      )}
    </div>
  );
}
