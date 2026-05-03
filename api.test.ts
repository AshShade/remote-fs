import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { fmtSize, listDir, checkPath, createDir, uploadFile } from "./ui/src/api";

describe("fmtSize", () => {
  test("formats bytes", () => expect(fmtSize(512)).toBe("512 B"));
  test("formats KB", () => expect(fmtSize(2048)).toBe("2.0 KB"));
  test("formats MB", () => expect(fmtSize(5242880)).toBe("5.0 MB"));
  test("formats GB", () => expect(fmtSize(2147483648)).toBe("2.0 GB"));
  test("zero bytes", () => expect(fmtSize(0)).toBe("0 B"));
  test("boundary KB", () => expect(fmtSize(1024)).toBe("1.0 KB"));
  test("boundary MB", () => expect(fmtSize(1048576)).toBe("1.0 MB"));
  test("boundary GB", () => expect(fmtSize(1073741824)).toBe("1.0 GB"));
});

describe("listDir", () => {
  test("returns entries on 200", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify([{ name: "a.txt", dir: false, size: 5, mtime: "2026-01-01" }]), { status: 200 }))) as any;
    const result = await listDir("/test");
    expect(result).toEqual([{ name: "a.txt", dir: false, size: 5, mtime: "2026-01-01" }]);
    globalThis.fetch = orig;
  });

  test("returns empty array on error", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("not found", { status: 404 }))) as any;
    expect(await listDir("/nope")).toEqual([]);
    globalThis.fetch = orig;
  });

  test("sends Accept: application/json header", async () => {
    const orig = globalThis.fetch;
    let capturedHeaders: any;
    globalThis.fetch = mock((url: string, opts: any) => {
      capturedHeaders = opts?.headers;
      return Promise.resolve(new Response("[]", { status: 200 }));
    }) as any;
    await listDir("/test");
    expect(capturedHeaders?.Accept).toBe("application/json");
    globalThis.fetch = orig;
  });
});

describe("checkPath", () => {
  test("returns isDir:true when HEAD returns application/json", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 200, headers: { "Content-Type": "application/json" } }))) as any;
    expect(await checkPath("/dir")).toEqual({ ok: true, isDir: true });
    globalThis.fetch = orig;
  });

  test("returns isDir:false when HEAD returns non-json", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 200, headers: { "Content-Type": "text/plain" } }))) as any;
    expect(await checkPath("/file.txt")).toEqual({ ok: true, isDir: false });
    globalThis.fetch = orig;
  });

  test("returns ok:false on 404", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("not found", { status: 404 }))) as any;
    expect(await checkPath("/ghost")).toEqual({ ok: false, isDir: false });
    globalThis.fetch = orig;
  });
});

describe("createDir", () => {
  test("returns true on success", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("{}", { status: 201 }))) as any;
    expect(await createDir("/new")).toBe(true);
    globalThis.fetch = orig;
  });

  test("returns false on failure", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("err", { status: 500 }))) as any;
    expect(await createDir("/fail")).toBe(false);
    globalThis.fetch = orig;
  });
});

describe("uploadFile", () => {
  test("returns true on success", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("{}", { status: 200 }))) as any;
    expect(await uploadFile("/f.txt", new ArrayBuffer(4))).toBe(true);
    globalThis.fetch = orig;
  });

  test("returns false on failure", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.resolve(new Response("err", { status: 500 }))) as any;
    expect(await uploadFile("/f.txt", new ArrayBuffer(4))).toBe(false);
    globalThis.fetch = orig;
  });
});

// Integration tests
import { rmSync, mkdirSync } from "fs";
import { join } from "path";
import { createHandler } from "./handler";

const ROOT = join(import.meta.dir, ".test-api-data");

describe("API integration", () => {
  let server: ReturnType<typeof Bun.serve>;
  let base: string;

  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: createHandler(ROOT) });
    base = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => { server?.stop(); rmSync(ROOT, { recursive: true, force: true }); });

  test("directory listing via Accept: application/json", async () => {
    await globalThis.fetch(`${base}/test.txt`, { method: "PUT", body: "hi" });
    const r = await globalThis.fetch(`${base}/`, { headers: { Accept: "application/json" } });
    expect(r.ok).toBe(true);
    const entries = await r.json() as { name: string }[];
    expect(entries.some(e => e.name === "test.txt")).toBe(true);
  });

  test("file content via fetch (no Accept: text/html)", async () => {
    await globalThis.fetch(`${base}/file.txt`, { method: "PUT", body: "data" });
    const r = await globalThis.fetch(`${base}/file.txt`);
    expect(await r.text()).toBe("data");
  });

  test("?download returns Content-Disposition", async () => {
    await globalThis.fetch(`${base}/dl.txt`, { method: "PUT", body: "content" });
    const r = await globalThis.fetch(`${base}/dl.txt?download`);
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
  });

  test("HEAD on directory returns application/json", async () => {
    mkdirSync(join(ROOT, "mydir"), { recursive: true });
    const r = await globalThis.fetch(`${base}/mydir/`, { method: "HEAD" });
    expect(r.ok).toBe(true);
    expect(r.headers.get("Content-Type")).toContain("application/json");
  });

  test("HEAD on file returns ok", async () => {
    await globalThis.fetch(`${base}/file.txt`, { method: "PUT", body: "data" });
    const r = await globalThis.fetch(`${base}/file.txt`, { method: "HEAD" });
    expect(r.ok).toBe(true);
  });

  test("POST creates directory", async () => {
    const r = await globalThis.fetch(`${base}/newdir`, { method: "POST" });
    expect(r.status).toBe(201);
  });
});
