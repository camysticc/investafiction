export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Parse a time from evidence or a form. All times are treated as UTC. */
export function parseTime(s: string): Date | null {
  if (!s) return null;
  let t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += "T00:00:00Z";
  else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(t)) t = t.replace(" ", "T") + "Z";
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtTime(s: string | Date | null | undefined, withSeconds = false): string {
  const d = typeof s === "string" ? parseTime(s) : s;
  if (!d) return typeof s === "string" ? s : "";
  const iso = d.toISOString();
  return iso.slice(0, 10) + " " + iso.slice(11, withSeconds ? 19 : 16);
}

export function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function inputTime(s: string): string {
  return fmtTime(s);
}

export function cls(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

export function plural(n: number, word: string, many?: string) {
  return `${n} ${n === 1 ? word : (many ?? word + "s")}`;
}

export async function svgToPngBase64(svg: SVGSVGElement, scale = 2): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("render failed"));
    img.src = url;
  });
  const vb = svg.viewBox.baseVal;
  const w = (vb && vb.width) || svg.clientWidth;
  const h = (vb && vb.height) || svg.clientHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png").split(",")[1];
}

export function svgToBase64(svg: SVGSVGElement): string {
  return btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
}
