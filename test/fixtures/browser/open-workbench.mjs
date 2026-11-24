import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gatewayFixture } from "../gateway/assemble-gateway.mjs";

const web = new URL("../../../web/", import.meta.url);
const require = createRequire(new URL("package.json", web));

export async function browserFixture(t, { viewport = { width: 1440, height: 1000 }, init, ...options } = {}) {
  const f = await gatewayFixture(t, { ...options, web: true });
  await f.deploy();
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  // Load the shipped proxy configuration: browser requests still cross Vite, Web and the Gateway socket.
  const old = process.env.PRK_API;
  process.env.PRK_API = f.url;
  let server;
  try {
    server = await createServer({ root: fileURLToPath(web), cacheDir: join(f.root, "vite"), server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  } finally {
    if (old === undefined) delete process.env.PRK_API;
    else process.env.PRK_API = old;
  }
  f.onCleanup(() => server.close());
  await server.listen();
  const url = server.resolvedUrls.local[0];
  assert(process.env.PI_TEST_PLAYWRIGHT && process.env.PI_TEST_CHROMIUM, "Chromium and Playwright paths are required");
  const { chromium } = await import(pathToFileURL(process.env.PI_TEST_PLAYWRIGHT));
  const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, args: ["--no-sandbox"] });
  f.onCleanup(() => browser.close());
  const page = await browser.newPage({ viewport, acceptDownloads: true, reducedMotion: "no-preference" });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  f.onCleanup(() => assert.deepEqual(errors, [], "uncaught browser exceptions"));
  if (init) await init(page);
  const open = async (id) => {
    await page.goto(new URL(`#sessionId=${id}`, url).href);
    await page.locator("#chat-thinking-select:not(:disabled)").waitFor();
  };
  return { ...f, page, open };
}
