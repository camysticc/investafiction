import { useMemo, useState } from "react";
import type { EvidenceItem } from "../lib/types";
import { parseCsv } from "../lib/util";

export default function TableViewer({ item, text, onTimeline }: { item: EvidenceItem; text: string; onTimeline: (p: { time: string; description: string }) => void }) {
  const rows = useMemo(() => parseCsv(text), [text]);
  const [head, ...body] = rows;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const tcol = item.table?.time_column ? head.indexOf(item.table.time_column) : -1;
  const dcols = (item.table?.description_columns ?? []).map((c) => head.indexOf(c)).filter((i) => i >= 0);
  const ecols = new Set((item.table?.entity_columns ?? []).map((c) => head.indexOf(c)));
  const filtered = useMemo(() => {
    let r = body.map((row, i) => ({ row, i }));
    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      r = r.filter(({ row }) => terms.every((t) => row.join(" ").toLowerCase().includes(t)));
    }
    if (sort) {
      const num = r.every(({ row }) => row[sort.col] === "" || !isNaN(Number(row[sort.col])));
      r = [...r].sort((a, b) => {
        const x = a.row[sort.col] ?? "";
        const y = b.row[sort.col] ?? "";
        return (num ? Number(x || 0) - Number(y || 0) : x.localeCompare(y)) * sort.dir;
      });
    }
    return r;
  }, [body, q, sort]);
  const PER = 200;
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const shown = filtered.slice(page * PER, page * PER + PER);
  const numericCols = head.map((_, c) => body.length > 0 && body.every((r) => r[c] === "" || (!isNaN(Number(r[c])) && /\./.test(r[c] || "") )));
  const totals = head.map((_, c) => (numericCols[c] ? filtered.reduce((s, { row }) => s + (Number(row[c]) || 0), 0) : null));
  return (
    <div className="table-view">
      <div className="row">
        <input className="grow" placeholder="Filter rows (all words must match)" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <span className="muted small">{filtered.length} of {body.length} rows</span>
        {pages > 1 && (
          <span className="row">
            <button className="small" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
            <span className="small">{page + 1}/{pages}</span>
            <button className="small" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
          </span>
        )}
      </div>
      <div className="table-scroll">
        <table className="grid data">
          <thead>
            <tr>
              <th />
              {head.map((h, c) => (
                <th key={c} onClick={() => setSort(sort?.col === c ? { col: c, dir: sort.dir === 1 ? -1 : 1 } : { col: c, dir: 1 })} className={ecols.has(c) ? "ent-col" : ""}>
                  {h} {sort?.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row, i }) => (
              <tr key={i}>
                <td className="row-act">
                  <button className="ghost small" title="Add this row to the timeline" onClick={() => onTimeline({ time: tcol >= 0 ? row[tcol] : item.acquired, description: (dcols.length ? dcols.map((d) => row[d]) : row.slice(0, 3)).join(" · ") })}>
                    ⏱
                  </button>
                </td>
                {row.map((cell, c) => <td key={c} className={ecols.has(c) ? "ent-col" : ""}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
          {totals.some((x) => x !== null) && (
            <tfoot>
              <tr>
                <td className="muted small">Σ</td>
                {totals.map((x, c) => <td key={c}>{x !== null ? x.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="muted small">Totals are for the filtered rows. Click a heading to sort. Use ⏱ to add a row to the timeline.</p>
    </div>
  );
}
