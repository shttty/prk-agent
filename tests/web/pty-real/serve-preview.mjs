import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * The App as the daily units serve it: `vite build` then `vite preview` (production React, minified, hashed chunks), using the
 * app's own vite.config.js (its /api proxy points at `api`). `webRoot` defaults to this checkout's web/; a test may pass
 * another web/ tree (e.g. a baseline). The bundle goes to a directory under TMPDIR, never into the product tree.
 */
export async function startPreview(api, { webRoot = `${repo}web/`, outDir = join(process.env.TMPDIR, `preview-${Date.now()}`) } = {}) {
  process.env.PRK_API = new URL(api).origin;
  const vite = await import(pathToFileURL(`${repo}web/node_modules/vite/dist/node/index.js`).href);
  const config = { configFile: `${webRoot}vite.config.js`, root: webRoot, logLevel: "warn", cacheDir: join(process.env.TMPDIR, "vite-cache") };
  await vite.build({ ...config, build: { outDir, emptyOutDir: true } });
  const server = await vite.preview({ ...config, build: { outDir }, preview: { host: "127.0.0.1", port: 0, strictPort: false } });
  return { url: new URL(server.resolvedUrls.local[0]).origin, outDir, close: () => new Promise((resolve) => server.httpServer.close(resolve)) };
}
