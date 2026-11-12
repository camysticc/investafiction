import { useEffect, useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { useSetting } from "../lib/settings";
import type { Claim, ClaimLink, Statement } from "../lib/types";
import { fmtTime } from "../lib/util";

const CLAIM_REL = [
  ["agrees", "Agrees with"],
  ["conflicts", "Conflicts with"],
  ["adds_detail", "Adds detail to"],
  ["unverifiable", "Cannot be checked"],
] as const;
const EV_REL = [
  ["supports", "Supported by evidence"],
  ["contradicts", "Contradicted by evidence"],
] as const;

export type ClaimStatus = "contradicted" | "conflicts" | "confirmed" | "consistent" | "unverified";
export const STATUS_LABEL: Record<ClaimStatus, string> = {
  contradicted: "Contradicted by evidence",
  conflicts: "Conflicts with another statement",
  confirmed: "Confirmed by evidence",
  consistent: "Consistent with another statement",
  unverified: "Unverified",
};

export function claimStatus(id: string, links: ClaimLink[]): ClaimStatus {
  const mine = links.filter((l) => l.claim === id || l.other_claim === id);
  if (mine.some((l) => l.claim === id && l.relation === "contradicts")) return "contradicted";
  if (mine.some((l) => l.relation === "conflicts")) return "conflicts";
  if (mine.some((l) => l.claim === id && l.relation === "supports")) return "confirmed";
  if (mine.some((l) => l.relation === "agrees" || l.relation === "adds_detail")) return "consistent";
  return "unverified";
}

export default function Statements() {
  const { game, act, select } = useApp();
  const layout = useSetting<string>("statements.layout");
  const maxOpen = Number(useSetting<string>("statements.compare_up_to")) || 3;
  const showNums = useSetting<boolean>("statements.show_claim_numbers");
  const offerSend = useSetting<boolean>("statements.offer_to_send_times_and_places_to_the_timeline_and_map");
  const showCount = useSetting<boolean>("statements.show_running_count_of_conflicts_found");
  const sts = game!.case.statements ?? [];
  const links = game!.attempt.claim_links ?? [];
  const [open, setOpen] = useState<string[]>(() => sts.slice(0, Math.min(2, maxOpen)).map((s) => s.id));
  const [sel, setSel] = useState<string | null>(null);
  const [rel, setRel] = useState<string>("conflicts");
  const [evPick, setEvPick] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [view, setView] = useState<"compare" | "summary">("compare");

  useEffect(() => {
    setOpen((o) => o.filter((id) => sts.some((s) => s.id === id)).slice(0, maxOpen));
  }, [sts.length, maxOpen]);

  const claims = useMemo(() => {
    const m: Record<string, { st: Statement; c: Claim }> = {};
    for (const st of sts) for (const c of st.claims) m[c.id] = { st, c };
    return m;
  }, [sts]);

  if (!sts.length)
    return (
      <div className="empty">
        <h3>No statements yet</h3>
        <p>Witness statements appear here once they are released. Each one is split into numbered claims you can compare side by side and check against the evidence.</p>
      </div>
    );

  const conflicts = links.filter((l) => l.relation === "conflicts").length;
  const isClaimRel = CLAIM_REL.some(([k]) => k === rel);
  const selected = sel ? claims[sel] : null;

  const linkTo = async (other: string | null) => {
    if (!sel) return;
    const r = await act({ type: "claim_link", claim: sel, relation: rel, other_claim: other ?? "", evidence: evPick, note });
    if (r) {
      setNote("");
      setEvPick([]);
      if (rel !== "unverifiable" || other) setSel(null);
    }
  };

  const toggleOpen = (id: string) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : o.length >= maxOpen ? [...o.slice(1), id] : [...o, id]));

  return (
    <div className="statements" data-help="tool.statements">
      <div className="st-head">
        <h2>Statement comparison</h2>
        <div className="seg">
          <button className={view === "compare" ? "on" : ""} onClick={() => setView("compare")}>Compare</button>
          <button className={view === "summary" ? "on" : ""} onClick={() => setView("summary")}>Summary table</button>
        </div>
        {showCount && <span className="pill">{conflicts} conflict{conflicts === 1 ? "" : "s"} marked · {links.length} link{links.length === 1 ? "" : "s"}</span>}
      </div>
      <p className="muted small">
        Pick up to {maxOpen} statements. Select a claim, choose how it relates, then click a claim in another statement or choose the evidence. A claim nobody can check is unverified, never false. People misremember: a difference is something to explain, not proof of a lie.
      </p>
      <div className="st-picker" role="group" aria-label="Statements to compare">
        {sts.map((s) => (
          <button key={s.id} className={`chip ${open.includes(s.id) ? "on" : ""}`} aria-pressed={open.includes(s.id)} onClick={() => toggleOpen(s.id)}>
            {s.witness} <span className="muted small">({s.role})</span>
          </button>
        ))}
      </div>

      {view === "compare" ? (
        <>
          <div className={`st-cols ${layout === "stacked" ? "stacked" : ""}`} style={{ gridTemplateColumns: layout === "stacked" ? "1fr" : `repeat(${Math.max(1, open.length)}, minmax(0, 1fr))` }}>
            {open.map((id) => {
              const st = sts.find((s) => s.id === id)!;
              return (
                <section key={id} className="st-col">
                  <header>
                    <strong>{st.witness}</strong>
                    <div className="muted small">{st.role} · {st.date} · <button className="linklike" onClick={() => select(st.evidence)}>{st.evidence}</button></div>
                  </header>
                  <ol className="st-claims">
                    {st.claims.map((c) => {
                      const status = claimStatus(c.id, links);
                      const target = sel && sel !== c.id && isClaimRel && rel !== "unverifiable";
                      return (
                        <li key={c.id} className={`claim s-${status} ${sel === c.id ? "sel" : ""} ${target ? "target" : ""}`}>
                          <button className="claim-body" onClick={() => (target ? linkTo(c.id) : setSel(sel === c.id ? null : c.id))} aria-pressed={sel === c.id}
                            aria-label={`${showNums ? c.id + ". " : ""}${c.text}. ${STATUS_LABEL[status]}.${target ? " Click to link." : ""}`}>
                            {showNums && <span className="claim-n">{c.id}</span>}
                            <span>{c.text}</span>
                          </button>
                          <div className="claim-meta">
                            <span className={`st-status s-${status}`}>{STATUS_LABEL[status]}</span>
                            {c.time && <span className="pill">⏱ {fmtTime(c.time)}</span>}
                            {c.place && <span className="pill">⌖ {game!.case.map?.locations.find((l) => l.id === c.place)?.label ?? c.place}</span>}
                            {offerSend && c.time && <button className="ghost small" onClick={() => act({ type: "claim_send", claim: c.id, to: "timeline" })}>→ Timeline</button>}
                            {offerSend && c.place && <button className="ghost small" onClick={() => act({ type: "claim_send", claim: c.id, to: "map" })}>→ Map</button>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
          {selected && (
            <div className="st-linker" role="region" aria-label="Link the selected claim">
              <div><b>{selected.c.id}</b> {selected.c.text} <span className="muted small">({selected.st.witness})</span></div>
              <div className="seg wrap" role="radiogroup" aria-label="How this claim relates">
                {[...CLAIM_REL, ...EV_REL].map(([k, label]) => (
                  <button key={k} role="radio" aria-checked={rel === k} className={rel === k ? "on" : ""} onClick={() => setRel(k)}>{label}</button>
                ))}
              </div>
              {isClaimRel ? (
                rel === "unverifiable" ? (
                  <div className="row"><span className="muted small">Mark this claim as one that cannot be checked with the material you have.</span><button className="primary" onClick={() => linkTo(null)}>Mark as cannot be checked</button></div>
                ) : (
                  <p className="muted small">Now click the claim it {rel === "agrees" ? "agrees with" : rel === "conflicts" ? "conflicts with" : "adds detail to"}. It can be in any open statement.</p>
                )
              ) : (
                <div>
                  <label className="small">Evidence that {rel === "supports" ? "supports" : "contradicts"} it</label>
                  <select multiple size={5} value={evPick} onChange={(e) => setEvPick([...e.target.selectedOptions].map((o) => o.value))} aria-label="Evidence">
                    {game!.case.evidence.filter((e) => !sts.some((s) => s.evidence === e.id)).map((e) => <option key={e.id} value={e.id}>{e.id} {e.title}</option>)}
                    {game!.attempt.captures.filter((c) => c.method === "full").map((c) => <option key={c.id} value={c.id}>{c.id} capture: {c.title}</option>)}
                  </select>
                  <button className="primary" disabled={!evPick.length} onClick={() => linkTo(null)}>Save link</button>
                </div>
              )}
              <input placeholder="Optional note, for example 'probably a memory slip about the month'" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              <button className="ghost small" onClick={() => setSel(null)}>Cancel</button>
            </div>
          )}
          {links.length > 0 && (
            <details className="st-links">
              <summary>Your links ({links.length})</summary>
              <ul>
                {links.map((l) => (
                  <li key={l.id}>
                    <b>{l.claim}</b> {[...CLAIM_REL, ...EV_REL].find(([k]) => k === l.relation)?.[1].toLowerCase()} {l.other_claim ? <b>{l.other_claim}</b> : l.evidence.join(", ")}
                    {l.note && <span className="muted"> · {l.note}</span>}
                    <button className="ghost small" aria-label="Remove link" onClick={() => act({ type: "claim_unlink", id: l.id })}>✕</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <table className="grid st-summary">
          <thead><tr><th>Claim</th><th>Witness</th><th>What it says</th><th>Status</th><th>Linked to</th></tr></thead>
          <tbody>
            {sts.flatMap((st) => st.claims.map((c) => {
              const status = claimStatus(c.id, links);
              const mine = links.filter((l) => l.claim === c.id || l.other_claim === c.id);
              return (
                <tr key={c.id}>
                  <td><code>{c.id}</code></td>
                  <td>{st.witness}</td>
                  <td>{c.text}</td>
                  <td><span className={`st-status s-${status}`}>{STATUS_LABEL[status]}</span></td>
                  <td className="small">{mine.map((l) => (l.other_claim ? (l.claim === c.id ? l.other_claim : l.claim) : l.evidence.join(", "))).join("; ")}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      )}
    </div>
  );
}
