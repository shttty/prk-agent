import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { readNativeSessionState } from "../../src/sessions/history/read-native-session-state.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-meta-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE || root;
await mkdir(evidence, { recursive: true });
await withTargetFixture(async ({ config }) => {
  let host, gateway, client, web, ui, browser;
  try {
    const { agentDir } = initializePrkHome(root);
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "metafast", models: [{ id: "controlled", reasoning: true }, { id: "plain" }] });
    runtime.registerNativeProvider(provider.provider);
    host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), model: "metafast/controlled", thinkingLevel: "off",
      config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { workerTools: "code" } }),
      targets: parseTargets([{ id: "fixture", label: "Fixture", tags: [], ...config, cwd: root }]),
    }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
    const socket = join(root, "g.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const { session: worker, snapshot } = await client.request("createSession", { target: "fixture", label: "Metafast fixture" });
    web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    await page.goto(ui.url);
    await page.locator(`[data-session-id="${worker.sessionId}"]`).first().click();
    await page.waitForFunction(() => document.querySelector("#chat-thinking-select")?.disabled === false);
    const nativePath = `/api/sessions/${encodeURIComponent(worker.sessionId)}/native`;
    const gets = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "GET" && path === nativePath.slice(0, -7)) gets.push(path);
    });
    for (const [action, selector, value, field] of [
      ["thinking", "#chat-thinking-select", "low", "thinkingLevel"],
      ["tool-mode", "#chat-tool-mode", "direct", "toolMode"],
    ]) {
      const held = Promise.withResolvers();
      const release = Promise.withResolvers();
      await page.route(`**${nativePath}`, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        held.resolve();
        await release.promise;
        await route.continue();
      });
      const before = gets.length;
      await page.locator(selector).click();
      await page.locator(`[role="option"][value="${value}"]`).click();
      await held.promise;
      assert.equal(await page.locator(selector).getAttribute("data-setting-value"), value);
      for (const id of ["#chat-model-select", "#chat-thinking-select", "#chat-tool-mode"]) assert.equal(await page.locator(id).isDisabled(), false);
      await page.screenshot({ path: join(evidence, `${action}-pending.png`) });
      const response = page.waitForResponse((response) => new URL(response.url()).pathname === nativePath && response.request().method() === "POST");
      release.resolve();
      assert.equal((await (await response).json()).status, "completed");
      await page.unroute(`**${nativePath}`);
      // Read outside the page, so acceptance observations cannot inflate its GET count.
      const current = action === "thinking"
        ? await client.request("state", { sessionId: worker.sessionId })
        : (await client.request("nativeCapabilities", { sessionId: worker.sessionId })).target.current;
      assert.equal(current[field], value);
      const sessions = await SessionManager.list(root, join(root, "history"));
      const persisted = sessions.find((entry) => entry.id === snapshot.sessionId);
      assert.ok(persisted, "SDK session is persisted");
      assert.equal(readNativeSessionState(SessionManager.open(persisted.path))[field], value);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(gets.length, before, "setting POST does not fetch the full snapshot");
    }
    for (const status of ["failed", "running"]) {
      await page.route(`**${nativePath}`, async (route) => {
        const { requestId, action } = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requestId, action, status }) });
      });
      await page.locator("#chat-thinking-select").click();
      await page.locator('[role="option"][value="high"]').click();
      await page.waitForFunction(() => document.querySelector("#chat-thinking-select")?.getAttribute("data-setting-value") === "low");
      assert.equal((await client.request("state", { sessionId: worker.sessionId })).thinkingLevel, "low");
      await page.unroute(`**${nativePath}`);
    }
    console.log("PASS light settings: optimistic enabled pickers, POST-only confirmation, persisted thinking/tool-mode");
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
