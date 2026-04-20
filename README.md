# remote-fs

Lightweight REST file server with `Last-Modified` support. Zero dependencies, runs on Bun.

## Usage

```bash
bun run server.ts [port] [root-dir]
bun run server.ts 5656 ~/.remote-fs
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET /path` | Read file | Returns raw content + `Last-Modified` header |
| `PUT /path` | Write file | Body = raw content. Returns `{ updatedAt }` |
| `HEAD /path` | Check freshness | Returns `Last-Modified`. Supports `If-Modified-Since` → `304` |
| `DELETE /path` | Delete file | Returns `{ deleted: true }` |

Files are stored under the root directory (default: `./data`). Nested paths create directories automatically.

## Example

```bash
# Write
curl -X PUT http://localhost:5656/xun/config.json -d '{"plugins":[]}'

# Read
curl http://localhost:5656/xun/config.json

# Check if modified (returns 304 if unchanged)
curl -I -H "If-Modified-Since: Mon, 20 Apr 2026 22:00:00 GMT" http://localhost:5656/xun/config.json
```
