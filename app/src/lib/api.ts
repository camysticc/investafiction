// Bridge to the Rust core. In the desktop app this goes through a single
// Tauri command. In a browser (development) it posts to the dev server.

export class ApiError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.details = details;
  }
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function call<T = any>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: any;
  if (isDesktop) {
    const { invoke } = await import("@tauri-apps/api/core");
    res = await invoke("call", { cmd, args });
  } else {
    const r = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd, args }) });
    res = await r.json();
  }
  if (!res.ok) throw new ApiError(res.error?.message ?? "Something went wrong.", res.error?.details ?? []);
  return res.data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function textToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

/** In a browser, also offer the exported file as a download. */
export function offerDownload(filename: string, b64: string) {
  if (isDesktop) return;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
