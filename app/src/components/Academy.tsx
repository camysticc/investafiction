import { useEffect, useMemo, useRef, useState } from "react";
import { playSound } from "../lib/settings";
import { RANKS, rankFor, totalXp, updateProgress, useProgress } from "../lib/progress";

/* ------------------------------------------------------------------ *
 * Training Academy: a small sandbox with an invented mini-case, seven
 * short missions, XP, ranks and badges. It never touches real cases or
 * saves, so it is safe to play, fail and replay.
 * ------------------------------------------------------------------ */

type Api = { mistake: (msg: string) => void; say: (msg: string) => void; done: () => void };
type Mission = { id: string; title: string; xp: number; badge: { icon: string; name: string }; goal: string; hint: string; Play: (p: { api: Api }) => JSX.Element };

const TILL = [
  { t: "16:58", what: "Sale", amt: "£6.40" },
  { t: "17:35", what: "Sale", amt: "£11.20" },
  { t: "18:04", what: "Drawer opened, no sale", amt: "" },
  { t: "18:05", what: "Cash removed from float", amt: "£150.00" },
  { t: "18:31", what: "Sale", amt: "£3.80" },
];
const DOCS: Record<string, { name: string; text: string }> = {
  "EV-1": { name: "Till log", text: TILL.map((r) => `${r.t} ${r.what} ${r.amt}`).join("\n") },
  "EV-2": { name: "Manager's email", text: "I counted the float at 17:50 and it was £200 exactly. I locked up at 18:10. The float was short by £150 when I opened on Saturday." },
  "EV-3": { name: "Staff door log", text: "Controller clock is 3 minutes ahead of real time.\n18:06 Staff door opened, badge 07\n18:19 Staff door closed, badge 07" },
};

async function sha256Hex(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return h.toString(16).padStart(8, "0").repeat(8);
  }
}

/* ---------------- Mission 1: scope ---------------- */
function Scope({ api }: { api: Api }) {
  const items = [
    { id: "a", text: "The shop's till logs", out: false, why: "Company records supplied for the enquiry are in scope." },
    { id: "b", text: "The manager's personal phone", out: true, why: "Personal devices are out of scope unless someone gives specific authority." },
    { id: "c", text: "The staff door log", out: false, why: "It belongs to the shop and is part of the records supplied." },
    { id: "d", text: "Staff members' personal social media", out: true, why: "Material about people with no link to the question is out of scope." },
  ];
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [ok, setOk] = useState(false);
  const check = () => {
    if (Object.keys(pick).length < items.length) return api.say("Mark every item first.");
    const wrong = items.find((i) => pick[i.id] !== i.out);
    if (wrong) return api.mistake(`Look again at "${wrong.text}". ${wrong.why}`);
    setOk(true);
    api.done();
  };
  return (
    <div>
      <p>The brief for this practice case: <em>"A £150 cash shortage at a corner shop. Establish when the cash left the till and what the records show. Company records supplied for this enquiry only. No personal devices or accounts unless authority is given."</em></p>
      <p className="ac-do">Mark each thing as <b>In scope</b> or <b>Out of scope</b>.</p>
      <ul className="ac-list">
        {items.map((i) => (
          <li key={i.id}>
            <span>{i.text}</span>
            <div className="seg">
              <button className={pick[i.id] === false ? "on" : ""} onClick={() => setPick({ ...pick, [i.id]: false })} disabled={ok}>In scope</button>
              <button className={pick[i.id] === true ? "on" : ""} onClick={() => setPick({ ...pick, [i.id]: true })} disabled={ok}>Out of scope</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={check} disabled={ok}>Check my answers</button>
    </div>
  );
}

/* ---------------- Mission 2: receipt, hashes, integrity ---------------- */
function Custody({ api }: { api: Api }) {
  const ids = Object.keys(DOCS);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<string | null>(null);
  const [result, setResult] = useState<"match" | "mismatch" | null>(null);
  const all = ids.every((i) => hashes[i]);
  const logIt = async (id: string) => setHashes({ ...hashes, [id]: await sha256Hex(DOCS[id].text) });
  const editCopy = async () => {
    setEdited(await sha256Hex(DOCS["EV-1"].text.replace("£150.00", "£15.00")));
    setResult("mismatch");
  };
  return (
    <div>
      <p>Before you rely on any item, <b>log its receipt</b>. The app fingerprints it with a SHA-256 hash. Change one character later and the fingerprint changes completely.</p>
      <ul className="ac-list">
        {ids.map((id) => (
          <li key={id}>
            <span><code>{id}</code> {DOCS[id].name}</span>
            {hashes[id] ? <code className="hash ok">{hashes[id].slice(0, 20)}…</code> : <button onClick={() => logIt(id)}>Log receipt</button>}
          </li>
        ))}
      </ul>
      {all && !result && (
        <div className="ac-step">
          <p className="ac-do">Now imagine someone edits the till log copy on the shared drive. Press the button to run an integrity check on it.</p>
          <button onClick={editCopy}>Run integrity check</button>
        </div>
      )}
      {result === "mismatch" && (
        <div className="ac-step">
          <div className="banner bad">
            <b>Mismatch.</b> <code>{edited!.slice(0, 20)}…</code> is not <code>{hashes["EV-1"].slice(0, 20)}…</code>
          </div>
          <p className="ac-do">What do you do?</p>
          <div className="ac-choices">
            <button onClick={() => api.mistake("Never fix evidence yourself. That would destroy the proof of what changed. Report it and work from the original copy.")}>Correct the figure back and carry on</button>
            <button onClick={() => { api.say("Right. Report the problem, keep the original, and do not try to repair it."); api.done(); }}>Report it and carry on with the original copy</button>
            <button onClick={() => api.mistake("Ignoring it means anything you build on that item could be challenged. Report it.")}>Ignore it, it is only one number</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Mission 3: sharp eyes ---------------- */
function Eyes({ api }: { api: Api }) {
  const [q, setQ] = useState(1);
  const sentences = DOCS["EV-2"].text.split(/(?<=\.)\s+/);
  return (
    <div>
      {q === 1 ? (
        <>
          <p className="ac-do"><b>Question 1.</b> Click the row of the till log where the cash left the drawer.</p>
          <table className="grid ac-table"><tbody>
            {TILL.map((r, i) => (
              <tr key={i} className="click" onClick={() => (i === 3 ? (api.say("Yes. 18:05, £150.00 removed. The row before it only shows the drawer opening."), setQ(2)) : api.mistake(i === 2 ? "Close, but that row only shows the drawer being opened with no sale. Which row shows money leaving?" : "That row is an ordinary event. Find the one that says cash was removed."))}>
                <td>{r.t}</td><td>{r.what}</td><td>{r.amt}</td>
              </tr>
            ))}
          </tbody></table>
        </>
      ) : (
        <>
          <p className="ac-do"><b>Question 2.</b> Click the sentence that says when the float was last known to be correct.</p>
          <div className="paper ac-paper">
            {sentences.map((s, i) => (
              <span key={i} className="click-sent" onClick={() => (i === 0 ? (api.say("Yes: £200 at 17:50. So the shortage happened after 17:50."), api.done()) : api.mistake("That sentence is about something else. Look for a count and a time."))}>{s} </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Mission 4: the trap ---------------- */
function Trap({ api }: { api: Api }) {
  const [warn, setWarn] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <div>
      <p>A new item has appeared in your list. Read the label carefully.</p>
      <div className={`ac-item ${opened ? "bad" : ""}`}>
        <div><code>EV-4</code> <b>Photos from the manager's personal phone</b> <span className="status s-mark">personal</span></div>
        <div className="muted small">Copied to the shared tablet by mistake.</div>
      </div>
      {!warn && !opened && (
        <div className="ac-choices">
          <button onClick={() => setWarn(true)}>Open it and have a look</button>
          <button onClick={() => { api.say("Correct. You leave it closed, note it as out of scope and tell your lead."); api.done(); }}>Leave it closed, record it as out of scope and tell the lead</button>
        </div>
      )}
      {warn && !opened && (
        <div className="banner bad">
          <div>
            <b>Training warning.</b> This item is marked personal and is outside your scope. Opening it would be a serious procedure mistake in a real case.
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => setWarn(false)}>Go back</button>
              <button className="danger" onClick={() => { setOpened(true); api.mistake("In Assessment mode there is no warning: the app would just mark it as a breach, and a serious breach caps your result. Try again and leave it closed."); }}>Open anyway</button>
            </div>
          </div>
        </div>
      )}
      {opened && <button onClick={() => { setOpened(false); setWarn(false); }}>Try again</button>}
    </div>
  );
}

/* ---------------- Mission 5: fact, inference, assumption ---------------- */
function Findings({ api }: { api: Api }) {
  const stmts = [
    { id: 1, text: "£150 was removed from the till at 18:05.", kind: "fact", why: "It is written in the record. Facts are what the evidence directly shows." },
    { id: 2, text: "The shortage happened after 17:50, because the float was correct then.", kind: "inference", why: "You are reasoning from the manager's count. An inference is a conclusion that follows from evidence but is not stated outright." },
    { id: 3, text: "Whoever took it needed the money.", kind: "assumption", why: "Nothing supports it. An assumption is something you accept without evidence, and it must be labelled." },
  ];
  const [kinds, setKinds] = useState<Record<number, string>>({});
  const [step, setStep] = useState<"classify" | "cite">("classify");
  const [cites, setCites] = useState<string[]>([]);
  const cls = () => {
    if (Object.keys(kinds).length < 3) return api.say("Label all three statements first.");
    const w = stmts.find((s) => kinds[s.id] !== s.kind);
    if (w) return api.mistake(`Not quite for "${w.text}". ${w.why}`);
    api.say("All three correct. Now back the fact up.");
    setStep("cite");
  };
  const toggle = (id: string) => setCites(cites.includes(id) ? cites.filter((c) => c !== id) : [...cites, id]);
  const checkCite = () => {
    if (cites.length === 1 && cites[0] === "EV-1") { api.say("The till log is the only item that shows the removal. A citation must point at the item that proves the point."); api.done(); }
    else if (!cites.includes("EV-1")) api.mistake("Which item actually shows cash being removed?");
    else api.mistake("Too many. Only cite the items that support the statement. The email and door log do not show cash leaving.");
  };
  return (
    <div>
      {step === "classify" ? (
        <>
          <p className="ac-do">Label each statement as a <b>Fact</b>, an <b>Inference</b> or an <b>Assumption</b>.</p>
          <ul className="ac-list">
            {stmts.map((s) => (
              <li key={s.id}>
                <span>{s.text}</span>
                <div className="seg">
                  {["fact", "inference", "assumption"].map((k) => (
                    <button key={k} className={kinds[s.id] === k ? "on" : ""} onClick={() => setKinds({ ...kinds, [s.id]: k })}>{k}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <button className="primary" onClick={cls}>Check</button>
        </>
      ) : (
        <>
          <p className="ac-do">Every finding needs citations. Which evidence supports: <em>"£150 was removed from the till at 18:05."</em>?</p>
          <div className="ac-chips">
            {Object.entries(DOCS).map(([id, d]) => (
              <button key={id} className={`ac-chip ${cites.includes(id) ? "on" : ""}`} onClick={() => toggle(id)}><code>{id}</code> {d.name}</button>
            ))}
          </div>
          <button className="primary" onClick={checkCite}>Add finding</button>
        </>
      )}
    </div>
  );
}

/* ---------------- Mission 6: timeline ---------------- */
function Timeline({ api }: { api: Api }) {
  const base = [
    { id: "a", t: "17:50", text: "Manager counts the float: £200", src: "EV-2", fix: 0 },
    { id: "d", t: "18:06", text: "Staff door opened, badge 07", src: "EV-3", fix: -3 },
    { id: "b", t: "18:04", text: "Drawer opened with no sale", src: "EV-1", fix: 0 },
    { id: "c", t: "18:05", text: "£150 removed from the float", src: "EV-1", fix: 0 },
    { id: "e", t: "18:10", text: "Manager locks up", src: "EV-2", fix: 0 },
  ];
  const mins = (t: string, fix: number) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m + fix;
  };
  const [fixed, setFixed] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const events = base.map((e) => ({ ...e, eff: fixed ? mins(e.t, e.fix) : mins(e.t, 0) }));
  const show = (e: (typeof events)[number]) => `${String(Math.floor(e.eff / 60)).padStart(2, "0")}:${String(e.eff % 60).padStart(2, "0")}`;
  const truth = [...base].sort((x, y) => mins(x.t, x.fix) - mins(y.t, y.fix)).map((e) => e.id);
  const tap = (id: string) => {
    if (order.includes(id)) return;
    const next = truth[order.length];
    if (id !== next) {
      if (!fixed && id === "d") return api.mistake("Look at the note on the door log: its clock runs 3 minutes fast. Correct that time first.");
      if (!fixed) return api.mistake("That is not the next event. One of the times needs correcting. Read the notes on each item.");
      return api.mistake("Not the earliest remaining event. Compare the corrected times.");
    }
    const o = [...order, id];
    setOrder(o);
    if (o.length === truth.length) { api.say("Perfect. Corrected, the door opened a minute before the drawer."); api.done(); }
  };
  return (
    <div>
      <p className="ac-do">Tap the events in time order, earliest first. Watch for clock notes.</p>
      <ul className="ac-list">
        {events.map((e) => (
          <li key={e.id} className={order.includes(e.id) ? "picked" : ""}>
            <button className="ac-event" onClick={() => tap(e.id)} disabled={order.includes(e.id)}>
              <b>{order.includes(e.id) ? order.indexOf(e.id) + 1 : "•"}</b> <code>{show(e)}</code> {e.text} <code className="muted">{e.src}</code>
            </button>
            {e.fix !== 0 && !fixed && <button className="ghost" onClick={() => setFixed(true)}>Clock runs +3 min: apply correction</button>}
            {e.fix !== 0 && fixed && <span className="pill ok">corrected −3 min</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Mission 7: careful voice ---------------- */
function Voice({ api }: { api: Api }) {
  const opts = [
    { t: "The cashier took the £150.", bad: "That names a person with no evidence. The records do not say who removed the cash." },
    { t: "£150 was removed at 18:05, after the float was confirmed at £200 at 17:50. The records do not show who removed it. A request for the login and badge records would help.", good: true },
    { t: "Nothing can be concluded from these records.", bad: "That is too cautious. You can prove what happened and when, even if not who did it." },
  ];
  return (
    <div>
      <p className="ac-do">Choose the best wording for the conclusion of your report. Separate what is <b>proved</b>, what is <b>likely</b> and what is <b>unknown</b>.</p>
      <div className="ac-choices">
        {opts.map((o) => (
          <button key={o.t} className="ac-quote" onClick={() => (o.good ? (api.say("That says what is proved, what is unknown and what would help next."), api.done()) : api.mistake(o.bad!))}>{o.t}</button>
        ))}
      </div>
    </div>
  );
}

const MISSIONS: Mission[] = [
  { id: "scope", title: "Know your limits", xp: 20, badge: { icon: "🧭", name: "Scope Keeper" }, goal: "Every case starts with a brief that says what you may and may not look at.", hint: "Things the company gave you for the enquiry are in. Personal devices and accounts are out unless someone gives authority.", Play: Scope },
  { id: "custody", title: "Protect the evidence", xp: 25, badge: { icon: "🔗", name: "Chain Keeper" }, goal: "Log receipt, fingerprint everything and never repair evidence.", hint: "Press Log receipt on all three, then run the integrity check. The right answer is always to report it.", Play: Custody },
  { id: "eyes", title: "Read it properly", xp: 20, badge: { icon: "🔍", name: "Sharp Eyes" }, goal: "Open the evidence and find what matters.", hint: "Look for the word 'removed' in the till log and for a count with a time in the email.", Play: Eyes },
  { id: "trap", title: "Spot the trap", xp: 20, badge: { icon: "📘", name: "By the Book" }, goal: "Some items should never be opened. Training mode warns you first.", hint: "Personal means out of scope. Do not open it.", Play: Trap },
  { id: "findings", title: "Fact, inference or assumption", xp: 30, badge: { icon: "⚖️", name: "Evidence Based" }, goal: "Label what you know honestly and cite the item that proves it.", hint: "Facts are directly in the record. Inferences follow from it. Assumptions have no support.", Play: Findings },
  { id: "timeline", title: "Build the timeline", xp: 25, badge: { icon: "⏱️", name: "Clockwork" }, goal: "Put events in order, correcting clocks that run fast or slow.", hint: "Apply the door clock correction first, then pick the earliest event each time.", Play: Timeline },
  { id: "voice", title: "Write it carefully", xp: 25, badge: { icon: "🖋️", name: "Careful Voice" }, goal: "Say what is proved, what is likely and what is unknown.", hint: "Avoid naming a person without evidence, and avoid saying nothing at all.", Play: Voice },
];

/* ---------------- shell ---------------- */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ l: (i * 29) % 100, d: (i % 9) * 0.12, c: ["#e8b04a", "#4b8fd6", "#5cc08a", "#e0678c", "#9d7bf0"][i % 5], r: (i * 47) % 360 })), []);
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => <span key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c, transform: `rotate(${b.r}deg)` }} />)}
    </div>
  );
}

export default function Academy({ onClose }: { onClose: () => void }) {
  const progress = useProgress();
  const xp = totalXp(progress);
  const rank = rankFor(xp);
  const nextRank = RANKS.find((r) => r.min > xp);
  const firstOpen = useRef(true);
  const startIdx = useMemo(() => {
    const i = MISSIONS.findIndex((m) => !progress.missions[m.id]);
    return i === -1 ? MISSIONS.length : i;
  }, []);
  const [idx, setIdx] = useState<number>(progress.academy === "new" || progress.academy === "skipped" ? -1 : startIdx);
  const [mistakes, setMistakes] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [fb, setFb] = useState<{ kind: "bad" | "good"; text: string; n: number } | null>(null);
  const [reward, setReward] = useState<{ xp: number; flawless: boolean; levelled: string | null } | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [shaking, setShaking] = useState(false);
  const m = idx >= 0 && idx < MISSIONS.length ? MISSIONS[idx] : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setConfirmSkip(true);
    window.addEventListener("keydown", h);
    firstOpen.current = false;
    return () => window.removeEventListener("keydown", h);
  }, []);

  const api: Api = {
    mistake: (text) => { setMistakes((n) => n + 1); setFb({ kind: "bad", text, n: Date.now() }); setShaking(true); setTimeout(() => setShaking(false), 400); playSound("bad"); },
    say: (text) => { setFb({ kind: "good", text, n: Date.now() }); playSound("click"); },
    done: () => {
      if (!m) return;
      const flawless = mistakes === 0 && !hintUsed;
      const gain = m.xp + (flawless ? 5 : 0);
      const before = rankFor(totalXp(progress)).name;
      const missions = { ...progress.missions, [m.id]: { xp: Math.max(progress.missions[m.id]?.xp ?? 0, gain), flawless } };
      const badges = progress.badges.includes(m.badge.name) ? progress.badges : [...progress.badges, m.badge.name];
      const after = rankFor(Object.values(missions).reduce((a, x) => a + x.xp, 0)).name;
      const allDone = MISSIONS.every((x) => missions[x.id]);
      updateProgress({ missions, badges, academy: allDone ? "done" : "started" });
      setReward({ xp: gain, flawless, levelled: after !== before ? after : null });
      playSound(after !== before ? "level" : "good");
    },
  };

  const go = (i: number) => { setIdx(i); setMistakes(0); setHintUsed(false); setShowHint(false); setFb(null); setReward(null); };
  const skipAll = () => { if (progress.academy !== "done") updateProgress({ academy: "skipped" }); onClose(); };
  const pct = nextRank ? Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100) : 100;

  return (
    <div className="academy" role="dialog" aria-modal="true" aria-label="Training Academy">
      <header className="ac-head">
        <div className="brand"><img src="/icon.svg" alt="" width={24} height={24} /> <span>Training Academy</span></div>
        <div className="ac-rank" title={nextRank ? `${nextRank.min - xp} XP to ${nextRank.name}` : "Top rank"}>
          <span className="ac-rank-name">{rank.name}</span>
          <div className="ac-xp"><div style={{ width: `${pct}%` }} /></div>
          <span className="ac-xp-n">{xp} XP</span>
        </div>
        <div className="ac-dots" aria-label="Missions">
          {MISSIONS.map((x, i) => (
            <button key={x.id} className={`ac-dot ${progress.missions[x.id] ? "done" : ""} ${i === idx ? "now" : ""}`} aria-label={`Mission ${i + 1}: ${x.title}`} title={x.title} onClick={() => go(i)} />
          ))}
        </div>
        {confirmSkip ? (
          <div className="ac-skipbox">
            <span>Skip the tutorial?</span>
            <button className="primary" onClick={skipAll}>Yes, skip</button>
            <button onClick={() => setConfirmSkip(false)}>Keep going</button>
          </div>
        ) : (
          <button className="ghost" onClick={() => setConfirmSkip(true)}>Skip tutorial ✕</button>
        )}
      </header>

      <main className="ac-main">
        {idx === -1 && (
          <section className="ac-card ac-intro">
            <div className="ac-big">🕵️</div>
            <h1>Welcome to the Academy</h1>
            <p>You are about to work real cases, from first brief to final report. This is a five minute practice run on a small made-up case, so you know exactly what to do.</p>
            <ul className="ac-bullets">
              <li>Seven short missions. Each one is hands-on.</li>
              <li>Earn <b>XP</b>, collect <b>badges</b> and climb from Trainee to Lead Investigator.</li>
              <li>Nothing here touches your real cases. Mistakes are free.</li>
            </ul>
            <div className="ac-mini">
              <b>The mini case:</b> a corner shop's cash float was £150 short on Saturday morning. You have a till log, a manager's email and a staff door log.
            </div>
            <div className="row">
              <button className="primary big" onClick={() => { updateProgress({ academy: "started" }); go(0); }}>Let's go</button>
              <button className="ghost" onClick={skipAll}>Skip, I'll figure it out</button>
            </div>
            <p className="muted small">You can open the Academy again any time from Settings or the case library.</p>
          </section>
        )}

        {m && !reward && (
          <section className="ac-card" key={m.id}>
            <div className="ac-kicker">Mission {idx + 1} of {MISSIONS.length} · {m.xp} XP</div>
            <h2>{m.title}</h2>
            <p className="muted">{m.goal}</p>
            <div className={`ac-play ${shaking ? "shake" : ""}`}>
              <m.Play api={api} />
            </div>
            {fb && <div className={`ac-fb ${fb.kind}`} role="status" aria-live="polite">{fb.kind === "good" ? "✓ " : "✗ "}{fb.text}</div>}
            <div className="ac-foot">
              <button className="ghost" onClick={() => { setShowHint(!showHint); setHintUsed(true); }}>{showHint ? "Hide hint" : "Need a hint?"}</button>
              <button className="ghost" onClick={() => go(idx + 1)}>Skip this mission →</button>
            </div>
            {showHint && <div className="ac-hint">💡 {m.hint} <span className="muted">(Using a hint removes the flawless bonus.)</span></div>}
          </section>
        )}

        {m && reward && (
          <section className="ac-card ac-reward">
            {reward.levelled && <Confetti />}
            <div className="ac-big pop">{m.badge.icon}</div>
            <h2>Mission complete</h2>
            <div className="ac-gain">+{reward.xp} XP{reward.flawless && <span className="pill ok"> flawless +5</span>}</div>
            <p>Badge earned: <b>{m.badge.name}</b></p>
            {reward.levelled && <div className="ac-level">⬆ New rank: <b>{reward.levelled}</b></div>}
            <button className="primary big" onClick={() => go(idx + 1)} autoFocus>{idx + 1 < MISSIONS.length ? "Next mission →" : "Finish"}</button>
          </section>
        )}

        {idx === MISSIONS.length && (
          <section className="ac-card ac-finish">
            <Confetti />
            <div className="ac-big pop">🏅</div>
            <h1>{rank.name}</h1>
            <p>{Object.keys(progress.missions).length === MISSIONS.length ? "You finished the Academy." : "Here is where you are so far."} You have {xp} XP.</p>
            <div className="ac-badges">
              {MISSIONS.map((x) => (
                <div key={x.id} className={`ac-badge ${progress.missions[x.id] ? "on" : ""}`} title={x.badge.name}>
                  <span>{progress.missions[x.id] ? x.badge.icon : "🔒"}</span>
                  <small>{x.badge.name}</small>
                </div>
              ))}
            </div>
            <div className="ac-cheat">
              <b>In a real case</b>: read the brief, log receipt of every item, open and read the evidence, record findings with citations, build the timeline, request third-party data only with a reason, then write your report.
            </div>
            <div className="row">
              <button className="primary big" onClick={onClose}>Go to the case library</button>
              <button onClick={() => go(0)}>Replay</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
