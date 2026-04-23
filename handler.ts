// remote-fs — lightweight REST file server with Last-Modified support
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync } from "fs";
import { join, resolve, relative } from "path";

function safePath(root: string, url: string): string | null {
  const decoded = decodeURIComponent(new URL(url, "http://x").pathname);
  const full = resolve(root, decoded.slice(1)); // strip leading /
  return full === root || full.startsWith(root + "/") ? full : null;
}

function cors(headers: Record<string, string> = {}): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, POST, HEAD, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, If-Modified-Since", ...headers };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(1) + " GB";
}

function dirHtml(dirPath: string, urlPath: string, root: string): string {
  const entries = readdirSync(dirPath, { withFileTypes: true })
    .filter(e => !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const rows = entries.map(e => {
    const stat = statSync(join(dirPath, e.name));
    const href = urlPath.replace(/\/$/, "") + "/" + encodeURIComponent(e.name) + (e.isDirectory() ? "/" : "");
    const icon = e.isDirectory() ? "📁" : "📄";
    const size = e.isDirectory() ? "—" : formatSize(stat.size);
    const mtime = stat.mtime.toISOString().replace("T", " ").slice(0, 19);
    const dl = e.isDirectory() ? "" : `<a href="${href}" download class="dl" title="Download">⬇</a>`;
    const target = e.isDirectory() ? "" : ` target="_blank"`;
    return `<tr><td>${icon}</td><td><a href="${href}"${target}>${e.name}${e.isDirectory() ? "/" : ""}</a></td><td>${dl}</td><td>${size}</td><td>${mtime}</td></tr>`;
  }).join("\n");

  const parent = urlPath !== "/" ? `<tr><td>📁</td><td><a href="${urlPath.replace(/\/[^/]*\/?$/, "/") || "/"}">..</a></td><td></td><td>—</td><td></td></tr>\n` : "";
  const display = urlPath === "/" ? "~" : "~" + urlPath;
  const parts = urlPath.split("/").filter(Boolean);
  const breadcrumb = [`<a href="/">~</a>`].concat(
    parts.map((p, i) => `<a href="/${parts.slice(0, i + 1).join("/")}/">${p}</a>`)
  ).join(" / ");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>remote-fs ${display}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1e1e2e; color: #cdd6f4; font-family: -apple-system, 'SF Mono', monospace; padding: 24px; }
  h1 { color: #cba6f7; font-size: 18px; margin-bottom: 16px; font-weight: 500; }
  h1 span { color: #585b70; }
  h1 span a { color: #a6adc8; }
  h1 span a:hover { color: #cba6f7; }
  h1 span a:last-child { color: #cdd6f4; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #a6adc8; font-size: 12px; font-weight: 500; padding: 6px 12px; border-bottom: 1px solid #313244; }
  td { padding: 8px 12px; border-bottom: 1px solid #313244; font-size: 14px; }
  tr:hover { background: #313244; }
  a { color: #89b4fa; text-decoration: none; }
  a:hover { color: #b4befe; text-decoration: underline; }
  td:first-child { width: 28px; text-align: center; }
  td:nth-child(3) { width: 32px; text-align: center; }
  td:nth-child(4) { color: #a6adc8; font-size: 13px; width: 80px; text-align: right; }
  td:nth-child(5) { color: #585b70; font-size: 12px; width: 160px; text-align: right; }
  .dl { color: #585b70; font-size: 12px; text-decoration: none; }
  .dl:hover { color: #89b4fa; }
  .footer { margin-top: 20px; color: #585b70; font-size: 12px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
  .toolbar button { background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  .toolbar button:hover { border-color: #cba6f7; color: #cba6f7; }
  .toolbar input[type=file] { display: none; }
  .pathbar { display: flex; gap: 8px; margin-bottom: 12px; }
  .pathbar input { flex: 1; background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 12px; font-size: 13px; font-family: inherit; outline: none; }
  .pathbar input:focus { border-color: #cba6f7; }
  .pathbar input::placeholder { color: #585b70; }
  .pathbar button { background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  .pathbar button:hover { border-color: #cba6f7; color: #cba6f7; }
</style></head><body>
<h1>remote-fs <span>${breadcrumb}</span></h1>
<div class="toolbar">
  <button onclick="mkdir()">📁 New folder</button>
  <button onclick="document.getElementById('upload').click()">📄 Upload file</button>
  <input type="file" id="upload" multiple onchange="upload(this.files)" />
</div>
<div class="pathbar">
  <input type="text" id="pathInput" placeholder="Enter absolute or relative path… (e.g. /projects/foo/bar.md)" onkeydown="if(event.key==='Enter')goPath()" />
  <button onclick="goPath()">Go</button>
</div>
<table>
<thead><tr><th></th><th>Name</th><th></th><th>Size</th><th>Modified</th></tr></thead>
<tbody>
${parent}${rows}
</tbody></table>
<div class="footer">${entries.length} items</div>
<script>
const base = "${urlPath.replace(/\/$/, "")}";
const ROOT = "${root}";
function mkdir() {
  const name = prompt("Folder name:");
  if (!name) return;
  fetch(base + "/" + encodeURIComponent(name), { method: "POST" })
    .then(() => location.reload());
}
function upload(files) {
  Promise.all([...files].map(f =>
    f.arrayBuffer().then(buf =>
      fetch(base + "/" + encodeURIComponent(f.name), { method: "PUT", body: buf })
    )
  )).then(() => location.reload());
}
function goPath() {
  let p = document.getElementById("pathInput").value.trim();
  if (!p) return;
  // Strip base path prefix (e.g. /home/user → "")
  if (p.startsWith(ROOT + "/")) p = p.slice(ROOT.length);
  else if (p === ROOT) p = "/";
  // Ensure leading slash
  if (!p.startsWith("/")) p = base + "/" + p;
  // Check if path is file or dir via HEAD
  fetch(p, { method: "HEAD" }).then(r => {
    if (!r.ok) { alert("Path not found: " + p); return; }
    const ct = r.headers.get("Content-Type") || "";
    if (ct.includes("text/html")) {
      // directory listing → navigate
      location.href = p;
    } else {
      // file → open in new tab, navigate to parent dir
      window.open(p, "_blank");
      const dir = p.slice(0, p.lastIndexOf("/") + 1) || "/";
      if (dir !== location.pathname) location.href = dir;
    }
  });
}
</script>
</body></html>`;
}

export function createHandler(root: string) {
  mkdirSync(root, { recursive: true });

  return async function fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    const path = safePath(root, req.url);
    if (!path) return new Response("bad path", { status: 400, headers: cors() });

    if (req.method === "HEAD" || req.method === "GET") {
      if (!existsSync(path)) return new Response("not found", { status: 404, headers: cors() });
      const stat = statSync(path);

      if (stat.isDirectory()) {
        if (req.method === "HEAD") return new Response(null, { status: 200, headers: cors({ "Content-Type": "text/html" }) });
        const urlPath = new URL(req.url, "http://x").pathname;
        return new Response(dirHtml(path, urlPath, root), { headers: { ...cors(), "Content-Type": "text/html; charset=utf-8" } });
      }

      const mtime = stat.mtime.toUTCString();
      const ims = req.headers.get("If-Modified-Since");
      if (ims && Math.floor(new Date(ims).getTime() / 1000) >= Math.floor(stat.mtimeMs / 1000)) {
        return new Response(null, { status: 304, headers: cors({ "Last-Modified": mtime }) });
      }
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: cors({ "Last-Modified": mtime }) });
      }
      const file = Bun.file(path);
      const ct = file.type === "application/octet-stream" ? "text/plain; charset=utf-8" : file.type;
      return new Response(file, { headers: cors({ "Last-Modified": mtime, "Content-Type": ct }) });
    }

    if (req.method === "PUT") {
      const dir = join(path, "..");
      mkdirSync(dir, { recursive: true });
      await Bun.write(path, await req.text());
      const mtime = statSync(path).mtime.toUTCString();
      return Response.json({ updatedAt: mtime }, { headers: cors({ "Last-Modified": mtime }) });
    }

    if (req.method === "DELETE") {
      if (!existsSync(path)) return new Response("not found", { status: 404, headers: cors() });
      unlinkSync(path);
      return Response.json({ deleted: true }, { headers: cors() });
    }

    if (req.method === "POST") {
      mkdirSync(path, { recursive: true });
      return Response.json({ created: true }, { status: 201, headers: cors() });
    }

    return new Response("method not allowed", { status: 405, headers: cors() });
  };
}
