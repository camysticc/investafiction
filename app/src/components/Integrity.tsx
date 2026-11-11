import { useState } from "react";
import { useApp } from "../lib/store";

export default function Integrity() {
  const { game, act } = useApp();
  const ev = game!.case.evidence;
  const [results, setResults] = useState<any[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [cmp, setCmp] = useState<any>(null);
  const [pasteId, setPasteId] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteRes, setPasteRes] = useState<any>(null);
  const [report, setReport] = useState<{ id: string; note: string } | null>(null);
  const run = async (ids: string[] | "all") => {
    const r = await act(ids === "all" ? { type: "hash_check", all: true } : { type: "hash_check", ids });
    if (r?.result) setResults(r.result);
  };
  const mismatched = ev.filter((e) => e.hashed && e.hash_ok === false);
  return (
    <div className="integrity">
      <h2>Hash and file integrity</h2>
      <p className="muted">SHA-256 is a fingerprint of a file. If one bit changes, the hash changes. Each item is compared with the hash recorded when it was first acquired and with the hash recorded when this pack was imported. Every check is written to the chain of custody.</p>
      <div className="row">
        <button className="primary" onClick={() => run("all")}>Hash every released item</button>
        <span className="muted small">{ev.filter((e) => e.hashed).length} of {ev.length} hashed</span>
      </div>
      {mismatched.length > 0 && (
        <div className="banner bad">
          <b>{mismatched.length} item(s) do not match their acquisition hash:</b> {mismatched.map((m) => m.id).join(", ")}. A mismatch is something to record, report and investigate. It does not prove wrongdoing by itself.
          {mismatched.map((m) => !game!.attempt.integrity_reports[m.id] && <button key={m.id} className="small" onClick={() => setReport({ id: m.id, note: "" })}>Report {m.id}</button>)}
        </div>
      )}
      {results.length > 0 && (
        <table className="grid">
          <thead><tr><th>Item</th><th>SHA-256 now</th><th>Acquisition record</th><th>Import record</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className={r.matches_original ? "" : "bad"}>
                <td><b>{r.id}</b></td>
                <td><code className="hash small">{r.hash}</code></td>
                <td>{r.matches_original ? "✓ match" : <b>✗ MISMATCH</b>}</td>
                <td>{r.matches_import ? "✓ match" : "✗ mismatch"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <section>
        <h3>Compare two files</h3>
        <div className="row">
          <select value={a} onChange={(e) => setA(e.target.value)} aria-label="First item"><option value="">First item</option>{ev.map((e) => <option key={e.id} value={e.id}>{e.id} {e.title}</option>)}</select>
          <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Second item"><option value="">Second item</option>{ev.map((e) => <option key={e.id} value={e.id}>{e.id} {e.title}</option>)}</select>
          <button disabled={!a || !b} onClick={async () => { const r = await act({ type: "hash_compare", a, b }); if (r) setCmp(r.result); }}>Compare</button>
        </div>
        {cmp && <p>{cmp.same ? "The two files are identical." : "The two files are different."} <code className="hash small">{cmp.a.slice(0, 20)}…</code> / <code className="hash small">{cmp.b.slice(0, 20)}…</code></p>}
      </section>
      <section>
        <h3>Check a hash you were given</h3>
        <div className="row">
          <select value={pasteId} onChange={(e) => setPasteId(e.target.value)} aria-label="Item"><option value="">Item</option>{ev.map((e) => <option key={e.id} value={e.id}>{e.id} {e.title}</option>)}</select>
          <input className="grow" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a SHA-256 hash" />
          <button disabled={!pasteId || paste.length < 10} onClick={async () => { const r = await act({ type: "hash_paste", id: pasteId, hash: paste }); if (r) setPasteRes(r.result); }}>Check</button>
        </div>
        {pasteRes && <p>{pasteRes.match ? "✓ The hash matches the file." : "✗ The hash does not match the file."}</p>}
      </section>
      {Object.keys(game!.attempt.integrity_reports).length > 0 && (
        <section>
          <h3>Integrity issues reported</h3>
          {Object.entries(game!.attempt.integrity_reports).map(([id, n]) => <p key={id}><b>{id}</b>: {n}</p>)}
        </section>
      )}
      {report && (
        <div className="modal-back"><div className="modal modal-small">
          <h3>Report an integrity issue with {report.id}</h3>
          <p className="muted small">Record what you found and what you have done. This goes to the case lead and into the custody log.</p>
          <textarea rows={4} value={report.note} onChange={(e) => setReport({ ...report, note: e.target.value })} placeholder="For example: SHA-256 does not match the acquisition record. I have stopped relying on this copy and asked for the original to be re-verified." />
          <div className="row-end"><button onClick={() => setReport(null)}>Cancel</button><button className="primary" disabled={report.note.length < 10} onClick={async () => { if (await act({ type: "report_integrity", id: report.id, note: report.note })) setReport(null); }}>Record and report</button></div>
        </div></div>
      )}
    </div>
  );
}
