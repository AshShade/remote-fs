// remote-fs — lightweight REST file server with Last-Modified support
import { existsSync, mkdirSync, unlinkSync, statSync } from "fs";
import { join, resolve } from "path";

function safePath(root: string, url: string): string | null {
  const decoded = decodeURIComponent(new URL(url, "http://x").pathname.slice(1));
  if (!decoded) return null;
  const full = resolve(root, decoded);
  return full.startsWith(root + "/") ? full : null;
}

function cors(headers: Record<string, string> = {}): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, HEAD, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, If-Modified-Since", ...headers };
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
      const mtime = stat.mtime.toUTCString();
      const ims = req.headers.get("If-Modified-Since");
      if (ims && new Date(ims).getTime() >= stat.mtimeMs) {
        return new Response(null, { status: 304, headers: cors({ "Last-Modified": mtime }) });
      }
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: cors({ "Last-Modified": mtime }) });
      }
      return new Response(Bun.file(path), { headers: cors({ "Last-Modified": mtime }) });
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

    return new Response("method not allowed", { status: 405, headers: cors() });
  };
}
