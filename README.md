# remote-fs

Lightweight REST file server with `Last-Modified` support and browser-based file browsing. Zero dependencies, runs on Bun.

## Usage

```bash
bun run server.ts [port] [root-dir]
bun run server.ts          # default: port 5656, root ~/
bun run server.ts 8080 /tmp
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET /path` | Read file | Returns raw content + `Last-Modified` header |
| `GET /dir/` | Browse directory | Returns Catppuccin Mocha themed file browser |
| `PUT /path` | Write file | Body = raw content. Returns `{ updatedAt }` |
| `HEAD /path` | Check freshness | Returns `Last-Modified`. Supports `If-Modified-Since` → `304` |
| `DELETE /path` | Delete file | Returns `{ deleted: true }` |

Files are served from the root directory (default: `~/`). Nested paths create directories automatically on PUT.

## Example

```bash
# Write
curl -X PUT http://localhost:5656/.xun-config -d '{"plugins":[]}'

# Read
curl http://localhost:5656/.xun-config

# Check if modified (returns 304 if unchanged)
curl -I -H "If-Modified-Since: Mon, 20 Apr 2026 22:00:00 GMT" http://localhost:5656/.xun-config

# Browse files in browser
open http://localhost:5656/projects/
```

## Run as service

```bash
# Copy service file
cp remote-fs.service ~/.config/systemd/user/

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now remote-fs
```
