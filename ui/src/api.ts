export interface DirEntry {
  name: string;
  dir: boolean;
  size: number;
  mtime: string;
}

export async function listDir(path: string): Promise<DirEntry[]> {
  const r = await fetch(path, { headers: { Accept: "application/json" } });
  return r.ok ? r.json() : [];
}

export async function checkPath(path: string): Promise<{ ok: boolean; isDir: boolean }> {
  const r = await fetch(path, { method: "HEAD" });
  if (!r.ok) return { ok: false, isDir: false };
  const ct = r.headers.get("Content-Type") || "";
  return { ok: true, isDir: ct.includes("application/json") };
}

export async function createDir(path: string): Promise<boolean> {
  const r = await fetch(path, { method: "POST" });
  return r.ok;
}

export async function uploadFile(path: string, buf: ArrayBuffer): Promise<boolean> {
  const r = await fetch(path, { method: "PUT", body: buf });
  return r.ok;
}

export async function deleteFile(path: string): Promise<boolean> {
  const r = await fetch(path, { method: "DELETE" });
  return r.ok;
}

export function fmtSize(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(1) + " GB";
}
