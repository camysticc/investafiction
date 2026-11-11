import { useEffect, useState } from "react";
import { call } from "../lib/api";
import { useApp } from "../lib/store";
import { Markdown } from "../lib/md";
import { fmtTime } from "../lib/util";
import { Empty, Modal } from "./common";

function Img({ path, onOpen }: { path: string; onOpen: (p: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    call("asset", { path }).then((r) => setSrc(r.data_url)).catch(() => setSrc(null));
  }, [path]);
  return src ? <img src={src} alt="" className="post-img" onClick={() => onOpen(path)} /> : <div className="post-img ph" />;
}

export default function Browser() {
  const { game, guarded, act, run, browserTarget, openPage } = useApp();
  const [url, setUrl] = useState("");
  const [page, setPage] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [image, setImage] = useState<{ path: string; data_url: string; metadata: Record<string, string> } | null>(null);
  const osint = game!.case.osint;

  const open = async (args: { page?: string; url?: string; snapshot?: number }) => {
    const r = await guarded("osint.open", args);
    if (!r) return;
    if (r.not_found) {
      setNotFound(true);
      setPage(null);
      return;
    }
    setNotFound(false);
    setResults(null);
    setPage(r.page);
    setUrl(r.page.url);
    setHistory((h) => [...h.filter((x) => x !== r.page.id), r.page.id]);
  };
  useEffect(() => {
    if (browserTarget) {
      open({ page: browserTarget });
      openPage(null);
    }
  }, [browserTarget]);
  const search = async () => {
    const r = await run(() => call("osint.search", { query: q }));
    if (r) {
      setResults(r);
      setPage(null);
      setNotFound(false);
    }
  };
  const showImage = (path: string) => run(async () => { const r = await call("asset", { path }); setImage({ path, ...r }); });
  if (!osint.enabled) return <Empty><h3>No simulated web in this case</h3><p>This case has no open source material.</p></Empty>;
  const caps = page ? game!.attempt.captures.filter((c) => c.page === page.id) : [];
  const site = page?.site;
  return (
    <div className="browser">
      <div className="browser-bar">
        <span className="sandbox-tag" title="Pages are rendered from case data. There is no network access.">Simulated web · offline</span>
        <input className="grow" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open({ url })} placeholder="https://… (.test addresses only)" aria-label="Address" />
        <button onClick={() => open({ url })}>Go</button>
      </div>
      <div className="browser-bar">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search the case's web by name, username, email or phone number" aria-label="Web search" />
        <button className="primary" onClick={search}>Search</button>
      </div>
      <div className="browser-body">
        <aside className="browser-side">
          <h4>Known sites</h4>
          {osint.sites.map((s: any) => <div key={s.id} className="small"><span className="swatch" style={{ background: s.colour }} /> <b>{s.name}</b> <span className="muted">{s.domain}</span></div>)}
          <h4>History</h4>
          {history.map((h) => <button key={h} className="link small" onClick={() => open({ page: h })}>{osint.pages.find((p) => p.id === h)?.title ?? h}</button>)}
          <h4>Captures</h4>
          {game!.attempt.captures.map((c) => <div key={c.id} className={`small ${c.method !== "full" ? "warn-text" : ""}`}><b>{c.id}</b> {c.title} {c.method !== "full" && "(screenshot, not evidence)"}</div>)}
        </aside>
        <div className="browser-page">
          {notFound && <Empty><h3>Page not found</h3><p>No page exists at that address in this case's web, or it has not been found yet.</p></Empty>}
          {results && (
            <div className="results">
              <p className="muted small">{results.length} results. Results can include unrelated people with similar names or handles. Check before you rely on a match.</p>
              {results.map((r) => (
                <div key={r.page} className="result">
                  <button className="link" onClick={() => open({ page: r.page })}>{r.title}</button>
                  <div className="small result-url">{r.url}</div>
                  <div className="small">{r.site}{r.handle && ` · @${r.handle}`} · {r.snippet}</div>
                </div>
              ))}
            </div>
          )}
          {!page && !results && !notFound && (
            <Empty>
              <p>Search for a name, username, email or number, or type an address.</p>
              <p className="muted small">Pages you can reach so far: {osint.pages.length}. More appear as the case develops.</p>
            </Empty>
          )}
          {page && (
            <div className="webpage" style={{ ["--site" as any]: site?.colour ?? "#3b6ea5" }}>
              <div className="site-head"><b>{site?.name}</b> <span>{site?.tagline}</span></div>
              {page.snapshot !== undefined && (
                <div className="banner clock">Archived copy captured {fmtTime(page.snapshot_captured)} UTC. {page.snapshot_note} <button className="small" onClick={() => open({ page: page.id })}>View live page</button></div>
              )}
              <div className="row page-tools">
                <button className="primary small" onClick={() => act({ type: "capture", page: page.id, method: "full", snapshot: page.snapshot })} disabled={!page.visible}>Capture page (time, address, hash)</button>
                <button className="small" onClick={() => act({ type: "capture", page: page.id, method: "screenshot", snapshot: page.snapshot })} disabled={!page.visible}>Quick screenshot</button>
                {page.snapshots.length > 0 && (
                  <select onChange={(e) => e.target.value !== "" && open({ page: page.id, snapshot: Number(e.target.value) })} value="" aria-label="Archive snapshots">
                    <option value="">Archive snapshots ({page.snapshots.length})</option>
                    {page.snapshots.map((s: any, i: number) => <option key={i} value={i}>{fmtTime(s.captured)} · {s.note}</option>)}
                  </select>
                )}
                <span className="muted small">Viewed {game!.attempt.page_views[page.id] ?? 0} time(s)</span>
                {caps.length > 0 && <span className="small good-text">Captured as {caps.filter((c) => c.method === "full").map((c) => c.id).join(", ")}</span>}
              </div>
              {page.kind === "profile" ? (
                <div className="profile-page">
                  <div className="profile-top">
                    {page.avatar ? <Img path={page.avatar} onOpen={showImage} /> : <div className="post-img ph avatar-ph" />}
                    <div>
                      <h2>{page.display_name || page.title}</h2>
                      {page.handle && <div className="muted">@{page.handle}</div>}
                      {page.visible && page.bio && <p>{page.bio}</p>}
                      {page.via_persona && <div className="warn-text small">Viewed through a persona account</div>}
                    </div>
                  </div>
                  {!page.visible ? (
                    <div className="private">
                      <h3>🔒 This account is private</h3>
                      <p>Only approved followers can see posts. Your authority covers public material only, unless you obtain specific authority through the Requests tab.</p>
                      <button className="danger small" onClick={() => guarded("act", { type: "persona", page: page.id }).then((r) => r?.result?.page && setPage(r.result.page))}>Send follow request from a persona account</button>
                    </div>
                  ) : (
                    <>
                      {page.fields && Object.keys(page.fields).length > 0 && <dl className="kv">{Object.entries(page.fields).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
                      {page.connections?.length > 0 && <p className="small"><b>Connections:</b> {page.connections.join(", ")}</p>}
                      <div className="posts">
                        {(page.posts ?? []).map((p: any) => (
                          <article key={p.id} className="post">
                            <div className="muted small">{fmtTime(p.time)} UTC{p.location_tag && ` · 📍 ${p.location_tag}`}{p.scheduled && " · scheduled post"}</div>
                            <p>{p.text}</p>
                            {p.image && <Img path={p.image} onOpen={showImage} />}
                            {p.comments?.length > 0 && <div className="comments">{p.comments.map((c: any, i: number) => <div key={i} className="small"><b>{c.by}</b> {c.text}</div>)}</div>}
                            {typeof p.likes === "number" && <div className="muted small">♥ {p.likes}</div>}
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="plain-page">
                  <h2>{page.title}</h2>
                  {page.visible && page.fields && Object.keys(page.fields).length > 0 && <dl className="kv">{Object.entries(page.fields).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
                  {page.visible && page.body && <Markdown text={page.body} />}
                  {page.visible && (page.posts ?? []).map((p: any) => <article key={p.id} className="post"><div className="muted small">{fmtTime(p.time)} UTC</div><p>{p.text}</p>{p.image && <Img path={p.image} onOpen={showImage} />}</article>)}
                </div>
              )}
              {page.links?.length > 0 && (
                <div className="page-links">
                  <h4>Links on this page</h4>
                  {page.links.map((l: any) => <button key={l.id} className="link small" onClick={() => open({ page: l.id })}>{l.title}</button>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {image && (
        <Modal title="Image" onClose={() => setImage(null)} wide>
          <div className="image-view">
            <div className="image-frame"><img src={image.data_url} alt="" /></div>
            <aside className="image-meta">
              <h4>Metadata</h4>
              {Object.keys(image.metadata).length ? <dl className="kv">{Object.entries(image.metadata).map(([k, v]) => <div key={k} className="kvrow"><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <p className="muted">No metadata. It may have been stripped when the image was uploaded.</p>}
              <p className="muted small">Look for signs, shop names, landmarks and the direction of shadows, then compare with the map.</p>
            </aside>
          </div>
        </Modal>
      )}
    </div>
  );
}
