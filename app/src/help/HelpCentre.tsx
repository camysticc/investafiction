import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../lib/md";
import { closeHelp, goTo, openAcademy, openHelp, openSettings, setWhatIsThis, useNav } from "../lib/nav";
import { useSetting } from "../lib/settings";
import { countHelpSearch } from "../lib/progress";
import { useApp } from "../lib/store";
import { lessonById } from "../academy/content";
import * as H from "./search";
import type { Article } from "./engine.js";

const CATS = ["Getting started", "Feature guides", "How to guides", "Troubleshooting", "Concepts", "Settings reference", "Scoring and marking", "Keyboard shortcuts", "Case authoring", "Privacy and data", "Glossary", "About"];

export default function HelpCentre({ full = false }: { full?: boolean }) {
  const nav = useNav();
  const { toast } = useApp();
  const witOn = useSetting<boolean>("academy.what_is_this_mode");
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState(nav.helpQuery || "");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<string | null>(nav.helpArticle);
  const [submitted, setSubmitted] = useState(nav.helpQuery || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const counted = useRef(false);

  useEffect(() => { H.warmUp().then(() => setReady(true)); }, []);
  useEffect(() => { setOpen(nav.helpArticle); if (nav.helpQuery) { setQ(nav.helpQuery); setSubmitted(nav.helpQuery); } }, [nav.helpArticle, nav.helpQuery]);
  useEffect(() => { if (!nav.helpArticle) setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !full && closeHelp();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [full]);

  const results = useMemo(() => (ready && q.trim() ? H.find(q, cat || undefined) : []), [ready, q, cat]);
  const suggestions = results.slice(0, 6);
  const top = results[0];
  const weak = !!submitted.trim() && (!top || top.score < 4);
  const art = open ? H.article(open) : null;

  const runSearch = () => {
    setSubmitted(q);
    setOpen(null);
    H.rememberSearch(q);
    if (!counted.current) { counted.current = true; countHelpSearch(); }
  };

  return (
    <aside className={`help-centre ${full ? "full" : "panel"}`} role="complementary" aria-label="Help centre" data-help="area.help">
      <header className="hc-head">
        <h2>{art ? <button className="ghost" onClick={() => setOpen(null)}>← Help</button> : "Help centre"}</h2>
        <div className="row">
          {witOn && <button className="ghost small" onClick={() => { setWhatIsThis(true); if (!full) closeHelp(); }} title="Click any part of the screen for an explanation (Shift+F1)">What is this?</button>}
          {!full && <button className="ghost small" onClick={() => goTo("help")} title="Open the help centre full size">⤢</button>}
          {!full && <button className="ghost small" aria-label="Close help" onClick={closeHelp}>✕</button>}
        </div>
      </header>
      <form className="hc-search" role="search" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
        <input ref={inputRef} type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(null); }} placeholder="Ask a question, for example 'how do I check if a file was changed?'" aria-label="Ask the help centre" list="hc-suggest" />
        <datalist id="hc-suggest">{suggestions.map((s) => <option key={s.id} value={s.article.title} />)}</datalist>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category"><option value="">All topics</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      </form>
      <div className="hc-body">
        {!ready && <p className="muted">Loading the help centre…</p>}
        {ready && art && <ArticleView a={art} onOpen={setOpen} onHelpful={(v) => { H.markHelpful(art.id, v); toast("Thanks. Your answer stays on this computer.", "good"); }} />}
        {ready && !art && q.trim() && (
          <>
            {top && !weak && (
              <section className="hc-answer" aria-label="Best answer">
                <div className="ac-kicker">Best answer · {top.article.category}</div>
                <h3><button className="linklike" onClick={() => setOpen(top.id)}>{top.article.title}</button></h3>
                <p>{top.article.answer}</p>
                {top.article.body && <div className="hc-steps"><Markdown text={top.article.body.split("\n\n").slice(0, 2).join("\n\n")} /></div>}
                <button className="small" onClick={() => setOpen(top.id)}>Read the full article</button>
              </section>
            )}
            {weak && (
              <section className="hc-none">
                <p><b>I could not find a good answer to that.</b> {results.length ? "These are the nearest topics:" : "Try other words, or browse the topics below."}</p>
                <button className="small" onClick={() => { H.saveUnanswered(submitted); toast("Saved to your list of questions with no answer.", "good"); }}>Save this question</button>
              </section>
            )}
            <ul className="hc-results">
              {results.slice(top && !weak ? 1 : 0, 12).map((r) => (
                <li key={r.id}><button className="linklike" onClick={() => setOpen(r.id)}>{r.article.title}</button> <span className="muted small">· {r.article.category}</span><div className="small muted">{r.article.answer}</div></li>
              ))}
            </ul>
          </>
        )}
        {ready && !art && !q.trim() && <Browse onOpen={setOpen} onSearch={(s) => { setQ(s); setSubmitted(s); }} />}
      </div>
    </aside>
  );
}

function ArticleView({ a, onOpen, onHelpful }: { a: Article; onOpen: (id: string) => void; onHelpful: (v: "yes" | "no") => void }) {
  const lesson = a.lesson ? lessonById(a.lesson) : null;
  const settingId = a.id.startsWith("setting.") ? a.id.slice(8) : null;
  const [voted, setVoted] = useState(H.helpData().helpful[a.id] ?? null);
  return (
    <article className="hc-article">
      <div className="ac-kicker">{a.category}</div>
      <h3>{a.title}</h3>
      <p className="hc-lead">{a.answer}</p>
      {a.body && <Markdown text={a.body} />}
      {settingId && <button className="small" onClick={() => openSettings(settingId)}>Go to this setting</button>}
      {lesson && <p><button className="linklike" onClick={() => openAcademy(lesson.id)}>🎓 Academy lesson: {lesson.title}</button></p>}
      {a.related.length > 0 && (
        <div className="hc-related"><h4>Related</h4><ul>{a.related.map((r) => { const ra = H.article(r); return ra ? <li key={r}><button className="linklike" onClick={() => onOpen(r)}>{ra.title}</button></li> : null; })}</ul></div>
      )}
      <div className="hc-helpful">
        {voted ? <span className="muted small">Thanks for the feedback.</span> : (
          <>Was this helpful? <button className="small" onClick={() => { setVoted("yes"); onHelpful("yes"); }}>Yes</button> <button className="small" onClick={() => { setVoted("no"); onHelpful("no"); }}>No</button></>
        )}
        <span className="muted small"> · applies to version {a.version ?? "1.3"}</span>
      </div>
    </article>
  );
}

function Browse({ onOpen, onSearch }: { onOpen: (id: string) => void; onSearch: (q: string) => void }) {
  const { toast } = useApp();
  const [tick, setTick] = useState(0);
  const d = H.helpData();
  const arts = H.articles();
  return (
    <div className="hc-browse" key={tick}>
      {d.recent.length > 0 && (
        <section><h4>Recent searches <button className="ghost small" onClick={() => { H.clearRecent(); setTick(tick + 1); }}>Clear</button></h4>
          <div className="row wrap">{d.recent.map((r) => <button key={r} className="chip" onClick={() => onSearch(r)}>{r}</button>)}</div></section>
      )}
      <section><h4>Popular</h4><ul>{["gs.first_case", "howto.log_and_hash", "feature.statements", "howto.make_request", "howto.capture_page", "scoring.how_marked", "howto.change_theme"].map((id) => H.article(id) && <li key={id}><button className="linklike" onClick={() => onOpen(id)}>{H.article(id)!.title}</button></li>)}</ul></section>
      {CATS.filter((c) => c !== "Settings reference" && c !== "Glossary").map((c) => {
        const list = arts.filter((a) => a.category === c);
        return list.length ? (
          <details key={c}><summary>{c} ({list.length})</summary><ul>{list.map((a) => <li key={a.id}><button className="linklike" onClick={() => onOpen(a.id)}>{a.title}</button></li>)}</ul></details>
        ) : null;
      })}
      <details><summary>Settings reference ({arts.filter((a) => a.category === "Settings reference").length})</summary><p className="muted small">Every setting has a short article. Search for it by name, or use the ? beside it in Settings.</p></details>
      <details><summary>Glossary ({arts.filter((a) => a.category === "Glossary").length} terms)</summary><dl className="glossary">{arts.filter((a) => a.category === "Glossary").map((a) => <div key={a.id}><dt>{a.title}</dt><dd>{a.answer}</dd></div>)}</dl></details>
      {d.unanswered.length > 0 && (
        <section className="hc-unanswered">
          <h4>Questions with no answer ({d.unanswered.length})</h4>
          <p className="muted small">Saved on this computer only. Copy them into a GitHub issue to help improve the help centre.</p>
          <ul>{d.unanswered.slice(0, 10).map((u) => <li key={u.q}>{u.q}</li>)}</ul>
          <div className="row">
            <button className="small" onClick={() => { navigator.clipboard?.writeText(d.unanswered.map((u) => `- ${u.q}`).join("\n")).then(() => toast("Copied.", "good")).catch(() => toast("Copy failed.", "error")); }}>Copy list</button>
            <button className="small ghost" onClick={() => { H.clearUnanswered(); setTick(tick + 1); }}>Clear</button>
          </div>
        </section>
      )}
      <p className="muted small">Everything here is stored inside the program. Searches are never sent anywhere. The help centre explains how the software works; it never gives away a case answer.</p>
      {void openHelp}
    </div>
  );
}
