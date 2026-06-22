import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { createHandler, safePath } from "./handler";

const ROOT = join(import.meta.dir, ".test-data");
let fetch: (req: Request) => Promise<Response>;

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  fetch = createHandler(ROOT);
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function req(method: string, path: string, body?: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/${path}`, { method, body, headers });
}

describe("PUT", () => {
  test("creates file and returns updatedAt", async () => {
    const res = await fetch(req("PUT", "test.json", '{"a":1}'));
    expect(res.status).toBe(200);
    const json = await res.json() as { updatedAt: string };
    expect(json.updatedAt).toBeTruthy();
  });

  test("creates nested directories", async () => {
    await fetch(req("PUT", "deep/nested/file.txt", "hello"));
    const get = await fetch(req("GET", "deep/nested/file.txt"));
    expect(await get.text()).toBe("hello");
  });

  test("overwrites existing file", async () => {
    await fetch(req("PUT", "f.txt", "v1"));
    await fetch(req("PUT", "f.txt", "v2"));
    const res = await fetch(req("GET", "f.txt"));
    expect(await res.text()).toBe("v2");
  });

  test("preserves binary data", async () => {
    const bin = new Uint8Array([0x00, 0x50, 0x4B, 0x03, 0x04, 0xFF, 0xFE, 0x80, 0x90]);
    const res = await fetch(new Request("http://localhost/bin.zip", { method: "PUT", body: bin }));
    expect(res.status).toBe(200);
    const get = await fetch(req("GET", "bin.zip"));
    const arr = new Uint8Array(await get.arrayBuffer());
    expect(arr).toEqual(bin);
  });
});

describe("GET file", () => {
  test("returns file content", async () => {
    await fetch(req("PUT", "hello.txt", "world"));
    const res = await fetch(req("GET", "hello.txt"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("world");
    expect(res.headers.get("Last-Modified")).toBeTruthy();
  });

  test("returns 404 for missing file", async () => {
    const res = await fetch(req("GET", "nope.txt"));
    expect(res.status).toBe(404);
  });

  test("returns markdown as plain text (no HTML rendering)", async () => {
    await fetch(req("PUT", "readme.md", "# Hello"));
    const res = await fetch(req("GET", "readme.md"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("# Hello");
  });
});

describe("GET directory", () => {
  test("returns JSON listing", async () => {
    await fetch(req("PUT", "dir/a.txt", "aaa"));
    await fetch(req("PUT", "dir/sub/b.txt", "bbb"));
    const res = await fetch(req("GET", "dir/"));
    expect(res.status).toBe(200);
    const entries = await res.json() as { name: string; dir: boolean; size: number }[];
    expect(entries.length).toBe(2);
    expect(entries[0].name).toBe("sub");
    expect(entries[0].dir).toBe(true);
    expect(entries[1].name).toBe("a.txt");
    expect(entries[1].size).toBe(3);
  });

  test("sorts directories before files", async () => {
    await fetch(req("PUT", "mixed/file.txt", "f"));
    await fetch(req("PUT", "mixed/subdir/inner.txt", "i"));
    const res = await fetch(req("GET", "mixed/"));
    const entries = await res.json() as { name: string; dir: boolean }[];
    expect(entries[0].name).toBe("subdir");
    expect(entries[1].name).toBe("file.txt");
  });

  test("returns 404 for missing directory", async () => {
    const res = await fetch(req("GET", "nope/"));
    expect(res.status).toBe(404);
  });

  test("symlinked directory shows as dir: true", async () => {
    const { symlinkSync } = await import("fs");
    mkdirSync(join(ROOT, "parent"));
    mkdirSync(join(ROOT, "parent", "real-dir"));
    writeFileSync(join(ROOT, "parent", "real-dir", "file.txt"), "content");
    symlinkSync(join(ROOT, "parent", "real-dir"), join(ROOT, "parent", "link-to-dir"));
    const res = await fetch(req("GET", "parent/"));
    const entries = await res.json() as { name: string; dir: boolean }[];
    const link = entries.find(e => e.name === "link-to-dir");
    expect(link?.dir).toBe(true);
  });
});

describe("content negotiation", () => {
  test("Accept: text/html serves SPA when dist exists", async () => {
    const distDir = join(import.meta.dir, "ui", "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.html"), "<html>SPA</html>");
    const handler = createHandler(ROOT);
    // File path with Accept: text/html → SPA
    await handler(req("PUT", "test.txt", "data"));
    const res = await handler(req("GET", "test.txt", undefined, { Accept: "text/html" }));
    expect(await res.text()).toBe("<html>SPA</html>");
    // Directory path with Accept: text/html → SPA
    mkdirSync(join(ROOT, "mydir"), { recursive: true });
    const res2 = await handler(req("GET", "mydir/", undefined, { Accept: "text/html" }));
    expect(await res2.text()).toBe("<html>SPA</html>");
    // Nonexistent path with Accept: text/html → SPA
    const res3 = await handler(req("GET", "ghost", undefined, { Accept: "text/html" }));
    expect(await res3.text()).toBe("<html>SPA</html>");
    rmSync(distDir, { recursive: true });
  });

  test("no Accept header serves raw content", async () => {
    await fetch(req("PUT", "test.txt", "raw data"));
    const res = await fetch(req("GET", "test.txt"));
    expect(await res.text()).toBe("raw data");
  });
});

describe("?download", () => {
  test("serves file with Content-Disposition", async () => {
    await fetch(req("PUT", "doc.pdf", "pdf-content"));
    const res = await fetch(new Request("http://localhost/doc.pdf?download"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("doc.pdf");
  });

  test("returns 404 for missing file", async () => {
    const res = await fetch(new Request("http://localhost/nope.txt?download"));
    expect(res.status).toBe(404);
  });

  test("zips directory for download", async () => {
    await fetch(req("PUT", "zdir/a.txt", "aaa"));
    await fetch(req("PUT", "zdir/b.txt", "bbb"));
    const res = await fetch(new Request("http://localhost/zdir/?download"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("zdir.zip");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});

describe("/__raw/", () => {
  test("serves raw HTML bypassing SPA", async () => {
    await fetch(req("PUT", "page.html", "<h1>Hi</h1>"));
    const res = await fetch(new Request("http://localhost/__raw/page.html", { headers: { Accept: "text/html" } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>Hi</h1>");
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  test("serves relative assets under same prefix", async () => {
    await fetch(req("PUT", "site/index.html", "<link href='style.css'>"));
    await fetch(req("PUT", "site/style.css", "body{color:red}"));
    const res = await fetch(new Request("http://localhost/__raw/site/style.css"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("body{color:red}");
  });

  test("returns 404 for missing file", async () => {
    const res = await fetch(new Request("http://localhost/__raw/nope.html"));
    expect(res.status).toBe(404);
  });
});

describe("HEAD", () => {
  test("file returns Last-Modified", async () => {
    await fetch(req("PUT", "h.txt", "data"));
    const res = await fetch(req("HEAD", "h.txt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Last-Modified")).toBeTruthy();
  });

  test("directory returns application/json Content-Type", async () => {
    await fetch(req("PUT", "dir/a.txt", "aaa"));
    const res = await fetch(req("HEAD", "dir/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  test("returns 404 for missing path", async () => {
    expect((await fetch(req("HEAD", "missing.txt"))).status).toBe(404);
  });
});

describe("If-Modified-Since", () => {
  test("returns 304 when not modified", async () => {
    await fetch(req("PUT", "cached.txt", "data"));
    const future = new Date(Date.now() + 60000).toUTCString();
    const res = await fetch(req("GET", "cached.txt", undefined, { "If-Modified-Since": future }));
    expect(res.status).toBe(304);
  });

  test("returns 200 when modified after timestamp", async () => {
    await fetch(req("PUT", "fresh.txt", "data"));
    const past = new Date(0).toUTCString();
    const res = await fetch(req("GET", "fresh.txt", undefined, { "If-Modified-Since": past }));
    expect(res.status).toBe(200);
  });
});

describe("DELETE", () => {
  test("deletes existing file", async () => {
    await fetch(req("PUT", "del.txt", "bye"));
    const res = await fetch(req("DELETE", "del.txt"));
    expect(res.status).toBe(200);
    expect((await res.json() as { deleted: boolean }).deleted).toBe(true);
  });

  test("returns 404 for missing file", async () => {
    expect((await fetch(req("DELETE", "ghost.txt"))).status).toBe(404);
  });
});

describe("POST mkdir", () => {
  test("creates directory", async () => {
    const res = await fetch(req("POST", "newdir"));
    expect(res.status).toBe(201);
    const ls = await fetch(req("GET", "newdir/"));
    expect(ls.status).toBe(200);
  });
});

describe("CORS", () => {
  test("OPTIONS returns CORS headers", async () => {
    const res = await fetch(req("OPTIONS", "any"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("all responses include CORS headers", async () => {
    const res = await fetch(req("GET", "nope.txt"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("X-Root returned when X-Want-Root sent", async () => {
    const res = await fetch(new Request("http://localhost/", { headers: { Accept: "application/json", "X-Want-Root": "1" } }));
    expect(res.headers.get("X-Root")).toBe(ROOT);
  });

  test("X-Root not returned without X-Want-Root", async () => {
    const res = await fetch(new Request("http://localhost/", { headers: { Accept: "application/json" } }));
    expect(res.headers.get("X-Root")).toBeNull();
  });
});

describe("security", () => {
  test("path traversal is neutralized", async () => {
    const res = await fetch(req("GET", "../../../etc/passwd"));
    expect(await res.text()).not.toContain("root:");
  });

  test("unsupported method returns 405", async () => {
    expect((await fetch(req("PATCH", "test.txt"))).status).toBe(405);
  });
});

describe("PWA", () => {
  test("serves manifest.json", async () => {
    const res = await fetch(req("GET", "__pwa/manifest.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
  });

  test("serves icon.svg", async () => {
    const res = await fetch(req("GET", "__pwa/icon.svg"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  test("serves sw.js", async () => {
    const res = await fetch(req("GET", "__pwa/sw.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/javascript");
  });
});

describe("safePath", () => {
  test("returns resolved path inside root", () => {
    expect(safePath("/srv", "http://x/file.txt")).toBe("/srv/file.txt");
  });

  test("returns root itself for /", () => {
    expect(safePath("/srv", "http://x/")).toBe("/srv");
  });

  test("normalizes path traversal attempts", () => {
    expect(safePath("/srv", "http://x/../etc/passwd")).toBe("/srv/etc/passwd");
  });
});

describe("dist serving", () => {
  const distDir = join(import.meta.dir, "ui", "dist");

  test("serves Vite assets from /assets/", async () => {
    mkdirSync(join(distDir, "assets"), { recursive: true });
    writeFileSync(join(distDir, "assets", "test.js"), "console.log('hi')");
    const handler = createHandler(ROOT);
    const res = await handler(req("GET", "assets/test.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    rmSync(join(distDir, "assets"), { recursive: true });
  });
});
