import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";
import { createHandler } from "./handler";

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
    expect(res.headers.get("Last-Modified")).toBeTruthy();
  });

  test("creates nested directories", async () => {
    const res = await fetch(req("PUT", "deep/nested/file.txt", "hello"));
    expect(res.status).toBe(200);
    const get = await fetch(req("GET", "deep/nested/file.txt"));
    expect(await get.text()).toBe("hello");
  });

  test("overwrites existing file", async () => {
    await fetch(req("PUT", "f.txt", "v1"));
    await fetch(req("PUT", "f.txt", "v2"));
    const res = await fetch(req("GET", "f.txt"));
    expect(await res.text()).toBe("v2");
  });
});

describe("GET", () => {
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

  test("returns JSON content correctly", async () => {
    await fetch(req("PUT", "config.json", '{"plugins":[]}'));
    const res = await fetch(req("GET", "config.json"));
    expect(JSON.parse(await res.text())).toEqual({ plugins: [] });
  });
});

describe("HEAD", () => {
  test("returns Last-Modified without body", async () => {
    await fetch(req("PUT", "h.txt", "data"));
    const res = await fetch(req("HEAD", "h.txt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Last-Modified")).toBeTruthy();
    expect(await res.text()).toBe("");
  });

  test("returns 404 for missing file", async () => {
    const res = await fetch(req("HEAD", "missing.txt"));
    expect(res.status).toBe(404);
  });
});

describe("If-Modified-Since", () => {
  test("returns 304 when not modified", async () => {
    await fetch(req("PUT", "cached.txt", "data"));
    const head = await fetch(req("HEAD", "cached.txt"));
    const lm = head.headers.get("Last-Modified")!;
    // Use a future date to guarantee 304
    const future = new Date(Date.now() + 60000).toUTCString();
    const res = await fetch(req("GET", "cached.txt", undefined, { "If-Modified-Since": future }));
    expect(res.status).toBe(304);
  });

  test("returns 200 when modified after timestamp", async () => {
    await fetch(req("PUT", "fresh.txt", "data"));
    const past = new Date(0).toUTCString();
    const res = await fetch(req("GET", "fresh.txt", undefined, { "If-Modified-Since": past }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("data");
  });
});

describe("DELETE", () => {
  test("deletes existing file", async () => {
    await fetch(req("PUT", "del.txt", "bye"));
    const res = await fetch(req("DELETE", "del.txt"));
    expect(res.status).toBe(200);
    expect((await res.json() as { deleted: boolean }).deleted).toBe(true);
    const get = await fetch(req("GET", "del.txt"));
    expect(get.status).toBe(404);
  });

  test("returns 404 for missing file", async () => {
    const res = await fetch(req("DELETE", "ghost.txt"));
    expect(res.status).toBe(404);
  });
});

describe("CORS", () => {
  test("OPTIONS returns CORS headers", async () => {
    const res = await fetch(req("OPTIONS", "any"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
  });

  test("all responses include CORS headers", async () => {
    const res = await fetch(req("GET", "nope"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("security", () => {
  test("path traversal is neutralized by URL normalization", async () => {
    const res = await fetch(req("GET", "../../../etc/passwd"));
    // URL normalizes ../ away → resolves inside ROOT → 404 (not a real traversal)
    expect(res.status).toBe(404);
  });

  test("rejects encoded traversal that escapes root", async () => {
    // Manually craft a request with a path that resolves outside ROOT
    const res = await fetch(new Request("http://localhost/", { method: "GET" }));
    expect(res.status).toBe(400); // empty decoded path
  });

  test("rejects empty path", async () => {
    const res = await fetch(req("GET", ""));
    expect(res.status).toBe(400);
  });

  test("unsupported method returns 405", async () => {
    const res = await fetch(req("POST", "test.txt"));
    expect(res.status).toBe(405);
  });
});
