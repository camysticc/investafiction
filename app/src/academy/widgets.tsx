/* The 'try it' activities used by lessons. Each calls onDone() once the
 * player has got it right. Wrong answers give a hint and another go. */
import { useEffect, useMemo, useState } from "react";
import { playSound } from "../lib/settings";

type P = { cfg: Record<string, any>; onDone: () => void };

function Feedback({ text, good }: { text: string | null; good: boolean }) {
  if (!text) return null;
  return <div className={`ac-fb ${good ? "good" : "bad"}`} role="status">{good ? "✓ " : "✗ "}{text}</div>;
}

async function sha256Hex(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 2166136261;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h.toString(16).padStart(8, "0").repeat(8);
  }
}

function Sort({ cfg, onDone }: P) {
  const [pick, setPick] = useState<Record<number, number>>({});
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  const items: [string, number][] = cfg.items;
  const check = () => {
    if (Object.keys(pick).length < items.length) return setFb(["Place every item first.", false]);
    const wrong = items.findIndex(([, b], i) => pick[i] !== b);
    if (wrong >= 0) { playSound("bad"); return setFb([`Look again at "${items[wrong][0]}".`, false]); }
    setFb(["All correct.", true]);
    playSound("good");
    onDone();
  };
  return (
    <div>
      <ul className="ac-list">
        {items.map(([text], i) => (
          <li key={i}>
            <span>{text}</span>
            <div className="seg wrap">
              {cfg.buckets.map((b: string, k: number) => <button key={k} className={pick[i] === k ? "on" : ""} aria-pressed={pick[i] === k} onClick={() => setPick({ ...pick, [i]: k })}>{b}</button>)}
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={check}>Check</button>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Reveal({ cfg, onDone }: P) {
  const [shown, setShown] = useState<boolean[]>(cfg.fields.map(() => false));
  const all = shown.every(Boolean);
  useEffect(() => { if (all) onDone(); }, [all]);
  return (
    <div>
      <dl className="kv reveal">
        {cfg.fields.map(([k, v]: [string, string], i: number) => (
          <div key={k} className="kv-row">
            <dt>{k}</dt>
            <dd>{shown[i] ? v : <button className="reveal-btn" onClick={() => { const s = [...shown]; s[i] = true; setShown(s); playSound("click"); }}>Click to reveal</button>}</dd>
          </div>
        ))}
      </dl>
      {all && <div className="ac-fb good">{cfg.after}</div>}
    </div>
  );
}

function Find({ cfg, onDone }: P) {
  const [ticks, setTicks] = useState<Record<number, boolean>>({});
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  const check = () => {
    const ok = cfg.items.every(([, want]: [string, boolean], i: number) => !!ticks[i] === want);
    if (!ok) { playSound("bad"); return setFb(["Not quite. Read each title for the street name.", false]); }
    setFb(["Found all three.", true]);
    playSound("good");
    onDone();
  };
  return (
    <div>
      <ul className="ac-list">
        {cfg.items.map(([text]: [string], i: number) => (
          <li key={i}><label className="row"><input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks({ ...ticks, [i]: e.target.checked })} /> {text}</label></li>
        ))}
      </ul>
      <button className="primary" onClick={check}>Check</button>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Choose({ cfg, onDone }: P) {
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  return (
    <div>
      <div className="ac-choices">
        {cfg.options.map(([text, right, why]: [string, boolean, string], i: number) => (
          <button key={i} className="ac-quote" disabled={!!fb?.[1]} onClick={() => { setFb([why, right]); playSound(right ? "good" : "bad"); if (right) onDone(); }}>{text}</button>
        ))}
      </div>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Hash({ cfg, onDone }: P) {
  const [text, setText] = useState<string>(cfg.start);
  const [hash, setHash] = useState("");
  const [first, setFirst] = useState("");
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    sha256Hex(text).then((h) => {
      setHash(h);
      if (!first) setFirst(h);
    });
  }, [text]);
  useEffect(() => { if (changes >= 3) onDone(); }, [changes]);
  return (
    <div>
      <input className="hash-input" value={text} onChange={(e) => { setText(e.target.value); setChanges((n) => n + 1); }} aria-label="Text to fingerprint" />
      <div className="hash-out"><span className="muted small">SHA-256</span><code>{hash}</code></div>
      {first && hash !== first && <div className="muted small">The original text's fingerprint started <code>{first.slice(0, 12)}</code>. Even one character makes it completely different.</div>}
      {changes >= 3 ? <div className="ac-fb good">✓ That is why matching hashes show a copy is identical.</div> : <div className="muted small">Make {3 - changes} more change{3 - changes === 1 ? "" : "s"}.</div>}
    </div>
  );
}

function Order({ cfg, onDone }: P) {
  const shuffled = useMemo(() => cfg.items.map((t: string, i: number) => [t, i] as const).sort((a: any, b: any) => ((a[1] * 7 + 3) % 5) - ((b[1] * 7 + 3) % 5)), [cfg]);
  const [picked, setPicked] = useState<number[]>([]);
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  const tap = (i: number) => {
    if (picked.includes(i)) return;
    if (i !== picked.length) { playSound("bad"); setFb(["Not the next one. Try again.", false]); return; }
    const p = [...picked, i];
    setPicked(p);
    setFb(null);
    if (p.length === cfg.items.length) { setFb(["Right order.", true]); playSound("good"); onDone(); }
  };
  return (
    <div>
      <ul className="ac-list">
        {shuffled.map(([t, i]: readonly [string, number]) => (
          <li key={i} className={picked.includes(i) ? "picked" : ""}>
            <button className="ac-event" onClick={() => tap(i)} disabled={picked.includes(i)}><b>{picked.includes(i) ? picked.indexOf(i) + 1 : "•"}</b> {t}</button>
          </li>
        ))}
      </ul>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Spot({ cfg, onDone }: P) {
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  return (
    <div>
      <ol className="spot-log">
        {cfg.lines.map((l: string, i: number) => (
          <li key={i}><button className="spot-line" disabled={!!fb?.[1]} onClick={() => { const ok = i === cfg.answer; setFb([ok ? cfg.explain : "That line is fine. Look at the order of events.", ok]); playSound(ok ? "good" : "bad"); if (ok) onDone(); }}>{l}</button></li>
        ))}
      </ol>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Numeric({ cfg, onDone }: P) {
  const [v, setV] = useState("");
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  return (
    <div className="row">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="HH:MM" aria-label="Your answer" />
      <button className="primary" onClick={() => { const ok = v.trim().replace(".", ":") === cfg.answer; setFb([ok ? cfg.explain : "Not quite. Fast means the clock is ahead.", ok]); playSound(ok ? "good" : "bad"); if (ok) onDone(); }}>Check</button>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Pairs({ cfg, onDone }: P) {
  const rights = useMemo(() => [...cfg.pairs.map((p: string[]) => p[1])].reverse(), [cfg]);
  const [left, setLeft] = useState<number | null>(null);
  const [made, setMade] = useState<Record<number, string>>({});
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  const pickRight = (r: string) => {
    if (left === null) return;
    if (cfg.pairs[left][1] !== r) { playSound("bad"); setFb(["That evidence does not show this connection.", false]); return; }
    const m = { ...made, [left]: r };
    setMade(m);
    setLeft(null);
    setFb(null);
    playSound("click");
    if (Object.keys(m).length === cfg.pairs.length) { setFb(["All matched.", true]); playSound("good"); onDone(); }
  };
  return (
    <div className="pairs">
      <div>{cfg.pairs.map((p: string[], i: number) => <button key={i} className={`chip ${left === i ? "on" : ""} ${made[i] ? "done" : ""}`} disabled={!!made[i]} onClick={() => setLeft(i)}>{p[0]}{made[i] ? ` ✓ ${made[i]}` : ""}</button>)}</div>
      <div>{rights.map((r: string) => <button key={r} className="chip" disabled={Object.values(made).includes(r)} onClick={() => pickRight(r)}>{r}</button>)}</div>
      <p className="muted small">Pick a connection on the left, then the evidence on the right.</p>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

function Grade({ cfg, onDone }: P) {
  const [g, setG] = useState<Record<number, [string, string]>>({});
  const [fb, setFb] = useState<[string, boolean] | null>(null);
  const close = (a: string, b: string) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1;
  const check = () => {
    const bad = cfg.items.findIndex(([, s, i]: string[], k: number) => !g[k] || !close(g[k][0], s) || !close(g[k][1], i));
    if (bad >= 0) { playSound("bad"); return setFb([`Think again about "${cfg.items[bad][0]}".`, false]); }
    setFb(["Close enough on all three. Grading is a judgement; within one step is fine.", true]);
    playSound("good");
    onDone();
  };
  return (
    <div>
      <ul className="ac-list">
        {cfg.items.map(([t]: string[], k: number) => (
          <li key={k}>
            <span>{t}</span>
            <span className="row">
              <select aria-label="Source grade" value={g[k]?.[0] ?? ""} onChange={(e) => setG({ ...g, [k]: [e.target.value, g[k]?.[1] ?? ""] })}><option value="">Source</option>{"ABCDE".split("").map((x) => <option key={x}>{x}</option>)}</select>
              <select aria-label="Information grade" value={g[k]?.[1] ?? ""} onChange={(e) => setG({ ...g, [k]: [g[k]?.[0] ?? "", e.target.value] })}><option value="">Info</option>{"12345".split("").map((x) => <option key={x}>{x}</option>)}</select>
            </span>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={check}>Check</button>
      <Feedback text={fb?.[0] ?? null} good={!!fb?.[1]} />
    </div>
  );
}

const MAP: Record<string, (p: P) => JSX.Element> = { sort: Sort, reveal: Reveal, find: Find, choose: Choose, hash: Hash, order: Order, spot: Spot, numeric: Numeric, pairs: Pairs, grade: Grade };
export function TryIt({ cfg, onDone }: P) {
  const W = MAP[cfg.type];
  return (
    <div className="tryit">
      <p className="ac-do">{cfg.prompt}</p>
      {W ? <W cfg={cfg} onDone={onDone} /> : <p>Unknown activity.</p>}
    </div>
  );
}

const PICTURES: Record<string, string> = {
  workspace: "🗂️", viewer: "📄", search: "🔎", notes: "📝", seal: "🔒", hash: "#️⃣", log: "📋", chain: "⛓️", timeline: "🕒", clock: "⏰", links: "🕸️",
  map: "🗺️", scales: "⚖️", lock: "🔐", camera: "📸", user: "👤", image: "🖼️", grade: "🅰️", corroborate: "🤝", report: "🖋️", balance: "⚖️", request: "✉️", trap: "⚠️",
};
export function Picture({ name }: { name: string }) {
  return <div className="lesson-pic" aria-hidden="true">{PICTURES[name] ?? "📘"}</div>;
}
