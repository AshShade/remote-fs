#!/usr/bin/env bun
import { join, resolve } from "path";
import { createHandler } from "./handler";

const PORT = parseInt(Bun.argv[2] || "9876", 10);
const ROOT = resolve(Bun.argv[3] || join(import.meta.dir, "data"));

Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: createHandler(ROOT) });
console.log(`remote-fs serving ${ROOT} on http://127.0.0.1:${PORT}`);
