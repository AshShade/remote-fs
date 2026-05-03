import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import http from "http";

function backendProxy(): Plugin {
  return {
    name: "backend-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        // Let Vite handle its own assets and PWA
        if (url.startsWith("/@") || url.startsWith("/node_modules/") || url.startsWith("/src/") || url.startsWith("/__pwa")) {
          return next();
        }
        const accept = req.headers.accept || "";
        const isHtml = accept.includes("text/html");
        const isDownload = url.includes("?download");
        // Browser navigation → let Vite serve SPA
        if (req.method === "GET" && isHtml && !isDownload) {
          return next();
        }
        // Everything else → proxy to backend
        const proxy = http.request(`http://127.0.0.1:5657${url}`, { method: req.method, headers: req.headers }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode!, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxy.on("error", () => { res.writeHead(502); res.end("Backend unavailable"); });
        req.pipe(proxy);
      });
    },
  };
}

export default defineConfig({
  plugins: [backendProxy(), vue()],
  root: "ui",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5656 },
});
