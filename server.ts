#!/usr/bin/env bun
import { join, resolve } from "path";
import { homedir } from "os";
import { createHandler } from "./handler";

const PORT = parseInt(Bun.argv[2] || "5656", 10);
const ROOT = resolve(Bun.argv[3] || homedir());

Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: createHandler(ROOT) });
console.log(`remote-fs serving ${ROOT} on http://127.0.0.1:${PORT}`);
