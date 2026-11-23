import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const web = `${repo}web/`;
const main = fileURLToPath(new URL("./harness-main.jsx", import.meta.url));

/** Vite dev server over web/ (real product modules, same config) that also serves /harness.html for the S3 harness. The
 * harness lives under tests/, so the product tree gets no new files; /api (HTTP and WebSocket) is proxied to the owned Gateway. */
export async function startHarness(api) {
  process.env.PRK_API = new URL(api).origin;
  const { createServer } = await import(pathToFileURL(`${web}node_modules/vite/dist/node/index.js`).href);
  const server = await createServer({
    configFile: `${web}vite.config.js`, root: web, clearScreen: false, cacheDir: join(process.env.TMPDIR, "vite-cache"),
    server: { host: "127.0.0.1", port: 0, strictPort: false, fs: { allow: [repo] } },
    resolve: { dedupe: ["react", "react-dom", "@mantine/core", "@mantine/hooks", "@tabler/icons-react", "@xterm/xterm"] },
    plugins: [{
      name: "s3-harness-page",
      configureServer(vite) {
        vite.middlewares.use("/harness.html", async (_request, response) => {
          const html = await vite.transformIndexHtml("/harness.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs${main}"></script></body></html>`);
          response.setHeader("content-type", "text/html");
          response.end(html);
        });
      },
    }],
  });
  await server.listen();
  return { url: new URL(server.resolvedUrls.local[0]).origin, close: () => server.close() };
}
