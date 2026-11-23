import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
// The backend (`node src/main.ts web`) serves only /api and accepts browser
// requests only from its own origin. The dev and preview servers proxy /api to
// it (PRK_API, default http://127.0.0.1:8787) and present requests that come
// from this page as the backend's own origin. Any other Origin is forwarded
// unchanged, so the backend still rejects cross-site mutations.
const api = new URL(process.env.PRK_API ?? "http://127.0.0.1:8787").origin;
const allowedHosts = (process.env.PRK_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean);
const proxy = {
  "/api": {
    target: api,
    changeOrigin: true,
    ws: true, // terminals are WebSockets; the same bypass rewrites their Origin
    bypass(request) {
      const origin = URL.parse(request.headers.origin ?? "");
      if (origin && (origin.protocol === "http:" || origin.protocol === "https:") && origin.host === request.headers.host) {
        request.headers.origin = api;
      }
    },
  },
};

// @chinese-fonts/maple-mono-cn names every style "Maple Mono CN" (weight/style tell them apart). The stack in
// app/tokens.css uses the app-owned "PRK Maple Mono CN" like the other bundled faces, so the package's CSS is renamed
// at build time (this file only; node_modules stays untouched).
const mapleFamily = {
  postcssPlugin: "prk-maple-family",
  AtRule: {
    "font-face"(rule) {
      if (!/@chinese-fonts[\\/]maple-mono-cn[\\/]/.test(rule.source?.input.file ?? "")) return;
      rule.walkDecls("font-family", (decl) => { decl.value = '"PRK Maple Mono CN"'; });
    },
  },
};

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  // Keep every webfont subset a separate file instead of a data: URI, so a
  // host that adds a CSP does not have to allow data: fonts.
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
  css: { postcss: { plugins: [mapleFamily] } },
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
});
