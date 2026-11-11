import { useMemo, useState } from "react";
import { fmtTime } from "../lib/util";

type Phone = {
  device?: Record<string, string>;
  contacts?: { name: string; number: string; note?: string }[];
  messages?: { app: string; thread: string; from: string; to: string; time: string; text: string; deleted?: boolean }[];
  calls?: { time: string; number: string; direction: string; duration_s: number; name?: string }[];
  locations?: { time: string; x: number; y: number; accuracy_m?: number; source?: string; place?: string }[];
  media?: { file: string; time: string; note?: string; caption?: string }[];
  apps?: { name: string; account?: string; note?: string }[];
};

export default function PhoneViewer({ text, onTimeline }: { text: string; onTimeline: (p: { time: string; description: string }) => void }) {
  const data: Phone = useMemo(() => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }, [text]);
  const tabs = ["device", "contacts", "messages", "calls", "locations", "media", "apps"].filter((k) => (data as any)[k] && (Array.isArray((data as any)[k]) ? (data as any)[k].length : true));
  const [tab, setTab] = useState(tabs[0] ?? "device");
  const threads = useMemo(() => {
    const m = new Map<string, NonNullable<Phone["messages"]>>();
    for (const msg of data.messages ?? []) {
      const k = `${msg.app} · ${msg.thread}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(msg);
    }
    for (const v of m.values()) v.sort((a, b) => a.time.localeCompare(b.time));
    return [...m.entries()];
  }, [data]);
  const [thread, setThread] = useState(0);
  return (
    <div className="phone-view">
      <nav className="seg">
        {tabs.map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </nav>
      {tab === "device" && <dl className="kv">{Object.entries(data.device ?? {}).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {tab === "contacts" && (
        <table className="grid"><thead><tr><th>Name</th><th>Number</th><th>Note</th></tr></thead>
          <tbody>{data.contacts!.map((c, i) => <tr key={i}><td>{c.name}</td><td>{c.number}</td><td>{c.note}</td></tr>)}</tbody></table>
      )}
      {tab === "messages" && (
        <div className="threads">
          <ul className="thread-list">
            {threads.map(([k, msgs], i) => (
              <li key={k}><button className={thread === i ? "on" : ""} onClick={() => setThread(i)}><b>{k}</b><span className="muted small">{msgs.length} messages</span></button></li>
            ))}
          </ul>
          <div className="thread">
            {threads[thread]?.[1].map((m, i) => (
              <div key={i} className={`bubble ${m.from === "owner" || m.from === "me" ? "me" : ""} ${m.deleted ? "deleted" : ""}`}>
                <div className="muted small">{m.from} · {fmtTime(m.time)} UTC {m.deleted && "· recovered deleted message"}
                  <button className="ghost small" title="Add to timeline" onClick={() => onTimeline({ time: m.time, description: `${m.app} message from ${m.from}: ${m.text.slice(0, 60)}` })}>⏱</button>
                </div>
                {m.text}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "calls" && (
        <table className="grid"><thead><tr><th /><th>Time (UTC)</th><th>Number</th><th>Name</th><th>Direction</th><th>Duration</th></tr></thead>
          <tbody>{data.calls!.map((c, i) => (
            <tr key={i}><td><button className="ghost small" onClick={() => onTimeline({ time: c.time, description: `${c.direction} call ${c.number}` })}>⏱</button></td><td>{fmtTime(c.time)}</td><td>{c.number}</td><td>{c.name}</td><td>{c.direction}</td><td>{c.duration_s}s</td></tr>
          ))}</tbody></table>
      )}
      {tab === "locations" && (
        <table className="grid"><thead><tr><th /><th>Time (UTC)</th><th>Place</th><th>x, y (m)</th><th>Accuracy</th><th>Source</th></tr></thead>
          <tbody>{data.locations!.map((l, i) => (
            <tr key={i}><td><button className="ghost small" onClick={() => onTimeline({ time: l.time, description: `Phone location ${l.place ?? ""}` })}>⏱</button></td><td>{fmtTime(l.time)}</td><td>{l.place}</td><td>{l.x}, {l.y}</td><td>{l.accuracy_m ? `${l.accuracy_m} m` : ""}</td><td>{l.source}</td></tr>
          ))}</tbody></table>
      )}
      {tab === "media" && (
        <table className="grid"><thead><tr><th>File</th><th>Time (UTC)</th><th>Note</th></tr></thead>
          <tbody>{data.media!.map((m, i) => <tr key={i}><td>{m.file}</td><td>{fmtTime(m.time)}</td><td>{m.caption ?? m.note}</td></tr>)}</tbody></table>
      )}
      {tab === "apps" && (
        <table className="grid"><thead><tr><th>App</th><th>Account</th><th>Note</th></tr></thead>
          <tbody>{data.apps!.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.account}</td><td>{m.note}</td></tr>)}</tbody></table>
      )}
    </div>
  );
}
