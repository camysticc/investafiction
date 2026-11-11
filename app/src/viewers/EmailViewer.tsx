import { useMemo, useState } from "react";

export function parseEmail(raw: string) {
  const text = raw.replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const headText = split >= 0 ? text.slice(0, split) : text;
  const body = split >= 0 ? text.slice(split + 2) : "";
  const headers: [string, string][] = [];
  for (const line of headText.split("\n")) {
    if (/^\s/.test(line) && headers.length) headers[headers.length - 1][1] += " " + line.trim();
    else {
      const i = line.indexOf(":");
      if (i > 0) headers.push([line.slice(0, i), line.slice(i + 1).trim()]);
    }
  }
  return { headers, body, headText };
}

function addr(s: string | undefined) {
  const m = /<([^>]+)>/.exec(s ?? "");
  return (m ? m[1] : s ?? "").trim().toLowerCase();
}

export default function EmailViewer({ text }: { text: string }) {
  const { headers, body, headText } = useMemo(() => parseEmail(text), [text]);
  const [raw, setRaw] = useState(false);
  const get = (k: string) => headers.find(([h]) => h.toLowerCase() === k.toLowerCase())?.[1];
  const main = ["From", "Reply-To", "To", "Cc", "Date", "Subject"];
  const from = addr(get("From"));
  const domain = (s: string) => s.split("@")[1] ?? "";
  return (
    <div className="email-view">
      <table className="grid headers">
        <tbody>
          {main.filter((k) => get(k)).map((k) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{get(k)} {k === "Reply-To" && domain(addr(get(k))) !== domain(from) && <span className="flag">domain differs from sender</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="small" onClick={() => setRaw(!raw)}>{raw ? "Hide" : "Show"} full headers ({headers.length})</button>
      </div>
      {raw && <pre className="raw headers-raw">{headText}</pre>}
      <div className="paper email-body">{body.split("\n").map((l, i) => <p key={i} className={l.startsWith(">") ? "quoted" : ""}>{l || " "}</p>)}</div>
    </div>
  );
}
