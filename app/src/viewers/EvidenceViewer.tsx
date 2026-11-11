import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { TYPE_LABELS, type EvidenceItem } from "../lib/types";
import { fmtTime } from "../lib/util";
import { Empty, GradeControl, Modal, TypeIcon } from "../components/common";
import { FindingForm } from "../components/Findings";
import { EventForm } from "../components/Timeline";
import TableViewer from "./TableViewer";
import EmailViewer from "./EmailViewer";
import PhoneViewer from "./PhoneViewer";
import { Markdown } from "../lib/md";

type Content = { kind: "text"; ext: string; text: string } | { kind: "image"; data_url: string };

export default function EvidenceViewer() {
  const { game, selected, select } = useApp();
  if (!game) return null;
  const item = game.case.evidence.find((e) => e.id === selected);
  if (!item) return <Overview onPick={select} />;
  return <ItemView key={item.id} item={item} />;
}

function Overview({ onPick }: { onPick: (id: string) => void }) {
  const { game } = useApp();
  const ev = game!.case.evidence;
  const stage = game!.case.stages.find((s) => s.id === game!.attempt.current_stage);
  const latest = [...game!.attempt.messages].pop();
  return (
    <div className="overview">
      <h2>{stage?.title}</h2>
      {latest && <div className="message lead"><div className="muted small">From {latest.from}</div><p>{latest.text}</p></div>}
      <p className="muted">Pick an item from the evidence list. Log its receipt first, then examine a working copy. Originals stay sealed unless you give a reason to open one.</p>
      <div className="stat-row">
        <div className="stat"><b>{ev.length}</b><span>items released</span></div>
        <div className="stat"><b>{ev.filter((e) => e.received).length}</b><span>receipt logged</span></div>
        <div className="stat"><b>{ev.filter((e) => e.examined).length}</b><span>examined</span></div>
        <div className="stat"><b>{ev.filter((e) => e.hashed).length}</b><span>hashed</span></div>
      </div>
      <div className="quick-list">
        {ev.filter((e) => !e.examined).slice(0, 12).map((e) => (
          <button key={e.id} className="quick" onClick={() => onPick(e.id)}><TypeIcon type={e.type} /> <b>{e.id}</b> {e.title}</button>
        ))}
      </div>
    </div>
  );
}

function ItemView({ item }: { item: EvidenceItem }) {
  const { act, guarded, game } = useApp();
  const [content, setContent] = useState<Content | null>(null);
  const [original, setOriginal] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [panel, setPanel] = useState<"content" | "meta" | "custody">("content");
  const [finding, setFinding] = useState(false);
  const [eventPrefill, setEventPrefill] = useState<{ time: string; description: string } | null>(null);
  const [note, setNote] = useState(item.note ?? "");

  const examine = async (as: "copy" | "original", why = "") => {
    const r = await guarded("evidence.open", { id: item.id, as, reason: why });
    if (r?.content) {
      setContent(r.content);
      setOriginal(as === "original");
      setPanel("content");
    }
  };
  useEffect(() => {
    if (item.examined) examine("copy");
  }, [item.id]);
  useEffect(() => {
    const h = setTimeout(() => note !== (item.note ?? "") && act({ type: "item_note", id: item.id, text: note }), 800);
    return () => clearTimeout(h);
  }, [note]);

  const offset = item.clock_offset_minutes ?? 0;
  return (
    <div className="item-view">
      <header className="item-head">
        <TypeIcon type={item.type} />
        <div className="grow">
          <h2><span className="muted">{item.id}</span> {item.title}</h2>
          <div className="muted small">{TYPE_LABELS[item.type] ?? item.type} · {item.source} · acquired {fmtTime(item.acquired)} by {item.acquired_by} · released {item.released_by?.startsWith("request") ? `by ${item.released_by}` : `in stage ${item.released_by?.slice(1)}`}</div>
        </div>
        <GradeControl target={item.id} grade={item.grade} />
      </header>
      {item.marking !== "none" && <div className={`banner mark-${item.marking}`}><b>Marked {item.marking}.</b> {item.handling}</div>}
      {item.marking === "none" && item.handling && <div className="banner">{item.handling}</div>}
      {offset !== 0 && <div className="banner clock"><b>Clock offset recorded:</b> this source's clock ran {Math.abs(offset)} minutes {offset > 0 ? "fast" : "slow"}. {item.clock_note} Subtract {offset} minutes to get true time.</div>}
      {item.timezone_note && <div className="banner clock">{item.timezone_note}</div>}
      <div className="item-actions row wrap">
        {!item.received && <button className="primary" onClick={() => act({ type: "log_receipt", ids: [item.id] })}>Log receipt</button>}
        <button className={item.received ? "primary" : ""} onClick={() => examine("copy")}>{content && !original ? "Reload working copy" : "Examine working copy"}</button>
        <button onClick={() => setReasonOpen(true)}>Open original…</button>
        <button onClick={() => act({ type: "hash_check", ids: [item.id] })}>Check hash</button>
        <button onClick={() => setFinding(true)}>+ Finding citing this</button>
        <button onClick={() => setEventPrefill({ time: item.acquired, description: item.title })}>+ Timeline event</button>
        <span className="grow" />
        <div className="seg">
          {(["content", "meta", "custody"] as const).map((p) => (
            <button key={p} className={panel === p ? "on" : ""} onClick={() => setPanel(p)}>{p === "content" ? "Content" : p === "meta" ? "Metadata" : "Chain of custody"}</button>
          ))}
        </div>
      </div>
      {original && content && (
        <div className="banner original">
          <b>You are viewing the ORIGINAL exhibit.</b> It is read-only. Your reason was recorded in the custody log.
          <span className="grow" />
          <button className="small" onClick={() => act({ type: "alter_original", id: item.id, op: "edit" })}>Edit original</button>
          <button className="small" onClick={() => act({ type: "alter_original", id: item.id, op: "rename" })}>Rename original</button>
          <button className="small" onClick={() => examine("copy")}>Back to working copy</button>
        </div>
      )}
      <div className="item-body">
        {panel === "content" && (content ? <ContentView item={item} content={content} onTimeline={setEventPrefill} /> : (
          <Empty>
            <p>{item.summary}</p>
            <p className="muted">{item.received ? "Receipt logged. Examine a working copy to see the content." : "Log receipt first, then examine a working copy. Examining before receipt leaves a gap in the chain of custody."}</p>
          </Empty>
        ))}
        {panel === "meta" && <MetaPanel item={item} />}
        {panel === "custody" && <CustodyPanel item={item} />}
      </div>
      <label className="field item-note">
        Notes on this item
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private working notes" />
      </label>
      {reasonOpen && (
        <Modal title="Open the original exhibit" onClose={() => setReasonOpen(false)}>
          <p>Principle 2: if you must access original data, you must be competent to do so and able to explain why and what the effect is. Most work should be done on the verified working copy.</p>
          <label className="field">
            Reason for accessing the original
            <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: to confirm a detail that may have been lost when the copy was made" />
          </label>
          <div className="row-end">
            <button onClick={() => setReasonOpen(false)}>Cancel</button>
            <button className="primary" disabled={reason.trim().length < 10} onClick={async () => { setReasonOpen(false); await examine("original", reason); setReason(""); }}>Record reason and open</button>
          </div>
        </Modal>
      )}
      {finding && <Modal title="New finding" onClose={() => setFinding(false)}><FindingForm prefillEvidence={[item.id]} onDone={() => setFinding(false)} /></Modal>}
      {eventPrefill && (
        <Modal title="Add to timeline" onClose={() => setEventPrefill(null)}>
          <EventForm initial={{ id: "", time: eventPrefill.time, description: eventPrefill.description, evidence: [item.id], entities: [], confidence: "", clock_note: "" }} onDone={() => setEventPrefill(null)} isNew />
        </Modal>
      )}
      {game?.attempt.integrity_reports[item.id] && <div className="banner bad">Integrity issue reported: {game.attempt.integrity_reports[item.id]}</div>}
    </div>
  );
}

function ContentView({ item, content, onTimeline }: { item: EvidenceItem; content: Content; onTimeline: (p: { time: string; description: string }) => void }) {
  if (content.kind === "image") {
    return (
      <div className="image-view">
        <div className="image-frame"><img src={content.data_url} alt={item.title} /></div>
        <aside className="image-meta">
          <h4>Image metadata</h4>
          <dl className="kv">{Object.entries(item.metadata).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {Object.keys(item.metadata).length === 0 && <p className="muted">No metadata recorded.</p>}
          <p className="muted small">Look for signs, landmarks and shadows as well as the metadata. Metadata can be missing or wrong.</p>
        </aside>
      </div>
    );
  }
  if (content.ext === "csv") return <TableViewer item={item} text={content.text} onTimeline={onTimeline} />;
  if (content.ext === "eml") return <EmailViewer text={content.text} />;
  if (content.ext === "json" && item.type === "phone_extraction") return <PhoneViewer text={content.text} onTimeline={onTimeline} />;
  if (content.ext === "md")
    return (
      <div className="doc-view">
        <div className="paper"><Markdown text={content.text} /></div>
        {Object.keys(item.metadata).length > 0 && (
          <aside className="doc-meta">
            <h4>Document metadata</h4>
            <dl className="kv">{Object.entries(item.metadata).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </aside>
        )}
      </div>
    );
  return <pre className="raw">{content.text}</pre>;
}

function MetaPanel({ item }: { item: EvidenceItem }) {
  return (
    <div className="meta-panel">
      <dl className="kv">
        <dt>Summary</dt><dd>{item.summary}</dd>
        <dt>Type</dt><dd>{TYPE_LABELS[item.type] ?? item.type}</dd>
        <dt>Source</dt><dd>{item.source}</dd>
        <dt>Independence group</dt><dd>{item.source_group} <span className="muted small">(items in the same group are not independent of each other)</span></dd>
        <dt>Acquired</dt><dd>{fmtTime(item.acquired)} UTC by {item.acquired_by}</dd>
        <dt>File</dt><dd><code>{item.file}</code></dd>
        <dt>Acquisition SHA-256</dt><dd><code className="hash">{item.original_hash}</code></dd>
        {item.tags.length > 0 && <><dt>Tags</dt><dd>{item.tags.join(", ")}</dd></>}
        {Object.entries(item.metadata).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </div>
  );
}

function CustodyPanel({ item }: { item: EvidenceItem }) {
  return (
    <div className="custody">
      <p className="muted small">The history supplied with the pack, followed by your own actions. Each entry is timestamped automatically.</p>
      <table className="grid">
        <thead><tr><th>When</th><th>Action</th><th>By</th><th>Detail</th></tr></thead>
        <tbody>
          {item.pack_custody.map((c, i) => <tr key={"p" + i} className="pack"><td>{fmtTime(c.time)}</td><td>{c.action}</td><td>{c.by}</td><td>{c.note}</td></tr>)}
          {item.custody.map((c) => (
            <tr key={c.id} className={c.action === "alter_blocked" ? "bad" : ""}>
              <td>{fmtTime(c.case_time)}</td>
              <td>{c.action.replace(/_/g, " ")}</td>
              <td>{c.by}</td>
              <td>{c.reason} {c.hash && <code className="hash small">{c.hash.slice(0, 16)}…</code>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.continuity_gap && <div className="banner bad">Continuity gap: this item was examined before its receipt was logged.</div>}
    </div>
  );
}
