import { useEffect, useState } from "react";
import { openHelp, setWhatIsThis } from "../lib/nav";
import * as H from "./search";
import type { Article } from "./engine.js";

/** Click any part of the screen to see a short explanation of it. */
export default function WhatIsThis() {
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [shown, setShown] = useState<{ a: Article; x: number; y: number } | null>(null);
  useEffect(() => { H.warmUp(); }, []);
  const resolve = (el: Element | null) => {
    const t = el?.closest("[data-help]") as HTMLElement | null;
    if (!t) return null;
    const id = t.dataset.help!;
    const a = H.article(id) ?? H.articles().find((x) => x.features.includes(id)) ?? null;
    return a ? { t, a } : null;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resolve(document.elementFromPoint(e.clientX, e.clientY));
      setHover(r ? r.t.getBoundingClientRect() : null);
    };
    const click = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".wit-pop, .wit-bar")) return;
      e.preventDefault();
      e.stopPropagation();
      const r = resolve(document.elementFromPoint(e.clientX, e.clientY));
      setShown(r ? { a: r.a, x: Math.min(e.clientX, window.innerWidth - 360), y: Math.min(e.clientY + 12, window.innerHeight - 200) } : null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setWhatIsThis(false);
    window.addEventListener("mousemove", move, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("mousemove", move, true); window.removeEventListener("click", click, true); window.removeEventListener("keydown", key); };
  }, []);
  return (
    <div className="wit" aria-live="polite">
      <div className="wit-bar">What is this? Click any part of the screen. <button className="small" onClick={() => setWhatIsThis(false)}>Done (Esc)</button></div>
      {hover && <div className="wit-hl" style={{ left: hover.left - 3, top: hover.top - 3, width: hover.width + 6, height: hover.height + 6 }} />}
      {shown && (
        <div className="wit-pop" style={{ left: shown.x, top: shown.y }} role="dialog" aria-label={shown.a.title}>
          <b>{shown.a.title}</b>
          <p>{shown.a.answer}</p>
          <button className="small" onClick={() => { setWhatIsThis(false); openHelp(shown.a.id); }}>Open the article</button>
        </div>
      )}
    </div>
  );
}
