// remote-fs — lightweight REST file server with Vue SPA frontend
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync, readFileSync } from "fs";
import { join, resolve, dirname, relative } from "path";
import { zipSync } from "fflate";

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const ICON_SVG = readFileSync(join(SELF_DIR, "icon.svg"), "utf-8");
const ICON_192 = readFileSync(join(SELF_DIR, "icon-192.png"));
const ICON_512 = readFileSync(join(SELF_DIR, "icon-512.png"));
const MANIFEST = JSON.stringify({ name: "remote-fs", short_name: "remote-fs", start_url: "/", display: "standalone", background_color: "#1e1e2e", theme_color: "#cba6f7", icons: [{ src: "/__pwa/icon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/__pwa/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/__pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] });
const SW_JS = `self.addEventListener("fetch",()=>{});`;
const DIST_DIR = join(SELF_DIR, "ui", "dist");

export function safePath(root: string, url: string): string | null {
  const decoded = decodeURIComponent(new URL(url, "http://x").pathname);
  const full = resolve(root, decoded.slice(1));
  return full === root || full.startsWith(root + "/") ? full : null; // security: defense-in-depth guard
}

function cors(headers: Record<string, string> = {}): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, POST, HEAD, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept, If-Modified-Since, X-Want-Root", "Access-Control-Expose-Headers": "X-Root", ...headers };
}

function zipDir(dirPath: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else files[relative(dirPath, full)] = new Uint8Array(readFileSync(full));
    }
  }
  walk(dirPath);
  return zipSync(files);
}

function dirJson(dirPath: string) {
  return readdirSync(dirPath)
    .filter(name => !name.startsWith("."))
    .map(name => {
      const stat = statSync(join(dirPath, name));
      const dir = stat.isDirectory();
      return { name, dir, size: dir ? 0 : stat.size, mtime: stat.mtime.toISOString().replace("T", " ").slice(0, 19) };
    })
    .sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function serveDistFile(filePath: string): Response | null {
  const full = join(DIST_DIR, filePath);
  if (!existsSync(full) || statSync(full).isDirectory()) return null;
  return new Response(Bun.file(full), { headers: cors({ "Cache-Control": "public, max-age=31536000, immutable" }) });
}

function serveIndex(): Response | null {
  const index = join(DIST_DIR, "index.html");
  if (!existsSync(index)) return null;
  return new Response(Bun.file(index), { headers: cors({ "Content-Type": "text/html; charset=utf-8" }) });
}

function wantsHtml(req: Request): boolean {
  return req.headers.get("Accept")?.includes("text/html") ?? false;
}

export function createHandler(root: string) {
  mkdirSync(root, { recursive: true });

  return async function fetch(req: Request): Promise<Response> {
    const wantRoot = req.headers.get("X-Want-Root") ? { "X-Root": root } : {};
    const h = (extra: Record<string, string> = {}) => cors({ ...wantRoot, ...extra });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h() });

    const url = new URL(req.url, "http://x");

    // PWA assets
    if (url.pathname === "/__pwa/manifest.json") return new Response(MANIFEST, { headers: h({ "Content-Type": "application/manifest+json" }) });
    if (url.pathname === "/__pwa/icon.svg") return new Response(ICON_SVG, { headers: h({ "Content-Type": "image/svg+xml" }) });
    if (url.pathname === "/__pwa/icon-192.png") return new Response(ICON_192, { headers: h({ "Content-Type": "image/png" }) });
    if (url.pathname === "/__pwa/icon-512.png") return new Response(ICON_512, { headers: h({ "Content-Type": "image/png" }) });
    if (url.pathname === "/__pwa/sw.js") return new Response(SW_JS, { headers: h({ "Content-Type": "application/javascript", "Service-Worker-Allowed": "/" }) });

    // Vite dist assets (JS, CSS, etc.)
    if (url.pathname.startsWith("/assets/")) {
      const res = serveDistFile(url.pathname);
      if (res) return res;
    }

    // /__raw/ — serve files directly, bypasses SPA (supports relative CSS/JS)
    if (url.pathname.startsWith("/__raw/")) {
      const rawPath = safePath(root, url.pathname.slice(6));
      if (!rawPath) return new Response("bad path", { status: 400, headers: h() });
      if (!existsSync(rawPath)) return new Response("not found", { status: 404, headers: h() });
      const stat = statSync(rawPath);
      if (stat.isDirectory()) return Response.json(dirJson(rawPath), { headers: h() });
      const file = Bun.file(rawPath);
      return new Response(file, { headers: h({ "Content-Type": file.type }) });
    }

    const path = safePath(root, req.url);
    if (!path) return new Response("bad path", { status: 400, headers: h() });

    if (req.method === "HEAD" || req.method === "GET") {
      // ?download — serve file or zip directory
      if (url.searchParams.has("download")) {
        if (!existsSync(path)) return new Response("not found", { status: 404, headers: h() });
        const stat = statSync(path);
        if (stat.isDirectory()) {
          const name = (path.split("/").pop() || "folder") + ".zip";
          const zip = zipDir(path);
          return new Response(zip, { headers: h({ "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` }) });
        }
        const name = path.split("/").pop() ?? "file";
        return new Response(Bun.file(path), { headers: h({ "Content-Disposition": `attachment; filename="${name}"` }) });
      }

      // Browser navigation (Accept: text/html) — always serve SPA
      if (req.method === "GET" && wantsHtml(req)) {
        const index = serveIndex();
        if (index) return index;
        // Fallback: no dist built — serve raw content
      }

      if (!existsSync(path)) return new Response("not found", { status: 404, headers: h() });
      const stat = statSync(path);

      // Directory
      if (stat.isDirectory()) {
        if (req.method === "HEAD") return new Response(null, { status: 200, headers: h({ "Content-Type": "application/json" }) });
        return Response.json(dirJson(path), { headers: h() });
      }

      // File
      const mtime = stat.mtime.toUTCString();
      const ims = req.headers.get("If-Modified-Since");
      if (ims && Math.floor(new Date(ims).getTime() / 1000) >= Math.floor(stat.mtimeMs / 1000)) {
        return new Response(null, { status: 304, headers: h({ "Last-Modified": mtime }) });
      }
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: h({ "Last-Modified": mtime }) });
      }
      const file = Bun.file(path);
      const ct = file.type === "application/octet-stream" ? "text/plain; charset=utf-8" : file.type;
      return new Response(file, { headers: h({ "Last-Modified": mtime, "Content-Type": ct }) });
    }

    if (req.method === "PUT") {
      const dir = join(path, "..");
      mkdirSync(dir, { recursive: true });
      await Bun.write(path, await req.arrayBuffer());
      const mtime = statSync(path).mtime.toUTCString();
      return Response.json({ updatedAt: mtime }, { headers: h({ "Last-Modified": mtime }) });
    }

    if (req.method === "DELETE") {
      if (!existsSync(path)) return new Response("not found", { status: 404, headers: h() });
      unlinkSync(path);
      return Response.json({ deleted: true }, { headers: h() });
    }

    if (req.method === "POST") {
      mkdirSync(path, { recursive: true });
      return Response.json({ created: true }, { status: 201, headers: h() });
    }

    return new Response("method not allowed", { status: 405, headers: h() });
  };
}
