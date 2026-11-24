import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { DEFAULT_GATEWAY_OPTIONS } from "../../../src/config/gateway/gateway-options.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { withTargetFixture } from "../../fixtures/target-fixture.mjs";
import { parseTargets } from "../target-instances/parse-targets.mjs";
import { startWebDev } from "../../fixtures/web-dev.mjs";

/**
 * One local-target Gateway + Web + Vite + Chromium page whose `/api` requests are recorded, so request-trim checks can
 * count what one user action really costs. `requests.since(mark, method, path)` counts requests after `mark`; `path`
 * is an exact pathname or a RegExp. `settle()` waits long enough for follow-up requests a handler would start.
 */
export async function withRequestWorkbench(run, { settings, requestTimeoutMs = DEFAULT_GATEWAY_OPTIONS.requestTimeoutMs } = {}) {
  const root = await mkdtemp(join(tmpdir(), "prk-reqtrim-"));
  const evidence = process.env.PI_TEST_WEB_EVIDENCE || root;
  await mkdir(evidence, { recursive: true });
  await withTargetFixture(async ({ config }) => {
    let host, gateway, client, web, ui, browser;
    try {
      const { agentDir } = initializePrkHome(root);
      if (settings) {
        await mkdir(agentDir, { recursive: true });
        await writeFile(join(agentDir, "settings.json"), JSON.stringify(settings));
      }
      const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "reqtrim", models: [{ id: "controlled", reasoning: true }], tokensPerSecond: 10000 });
      runtime.registerNativeProvider(provider.provider);
      host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), model: "reqtrim/controlled", thinkingLevel: "off",
        config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { workerTools: "code" } }),
        targets: parseTargets([{ id: "fixture", label: "Fixture", tags: [], ...config, cwd: root }]),
      }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
      const socket = join(root, "g.sock");
      const gatewayOptions = { ...DEFAULT_GATEWAY_OPTIONS, requestTimeoutMs };
      gateway = await startGateway(host, socket, gatewayOptions);
      client = await connectGateway(socket, gatewayOptions);
      web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0, gateway: gatewayOptions });
      ui = await startWebDev(web.server.url);
      const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
      browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const log = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith("/api/")) log.push({ method: request.method(), path: url.pathname });
      });
      const requests = {
        mark: () => log.length,
        since: (mark, method, path) => log.slice(mark).filter((entry) => entry.method === method
          && (path instanceof RegExp ? path.test(entry.path) : entry.path === path)).length,
        list: (mark) => log.slice(mark).map((entry) => `${entry.method} ${entry.path}`),
      };
      const settle = () => page.waitForTimeout(800);
      const session = (sessionId) => `/api/sessions/${encodeURIComponent(sessionId)}`;
      const createSession = async (label, extra = {}) => (await client.request("createSession", { target: "fixture", label, ...extra })).session.sessionId;
      await run({ root, evidence, host, client, web, ui, page, provider, requests, settle, session, createSession, errors });
    } finally {
      await browser?.close();
      await client?.disconnect();
      await ui?.close();
      await web?.close();
      await gateway?.close();
      await host?.close();
    }
  });
  await rm(root, { recursive: true, force: true });
}

/** Open the page on the workbench and select `sessionId` from its sidebar row; resolves once the live stream is connected. */
export async function openSession(page, url, sessionId) {
  if (url) await page.goto(url);
  await page.locator(`[data-session-id="${sessionId}"]`).first().click();
  await page.waitForFunction(() => document.querySelector("#chat-thinking-select")?.disabled === false);
}
