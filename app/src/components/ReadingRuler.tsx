import { useEffect, useState } from "react";
import { useSetting } from "../lib/settings";

export default function ReadingRuler() {
  const on = useSetting<boolean>("accessibility.reading_ruler");
  const [y, setY] = useState(-100);
  useEffect(() => {
    if (!on) return;
    const h = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, [on]);
  if (!on) return null;
  return <div className="reading-ruler" style={{ top: y - 18 }} aria-hidden="true" />;
}
