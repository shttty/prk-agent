import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-outcomes-"));
async function until(predicate, description) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) { const result = await predicate(); if (result) return result; await new Promise((resolve) => setTimeout(resolve, 25)); }
  throw new Error(`Timed out: ${description}`);
}
let host, gateway, client, web, ui, browser;
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  await withTargetFixture(async ({ config, onCleanup }) => {
    onCleanup(async () => {
      await browser?.close(); await ui?.close(); await web?.close(); await client?.disconnect();
      if (gateway) await gateway.close(); else await host?.close();
    });
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "outcome-fixture", models: [{ id: "controlled" }], tokensPerSecond: 1_000_000 });
    runtime.registerNativeProvider(provider.provider);
    const socket = join(root, "gateway.sock");
    host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), targets: parseTargets([{ id: "fixture", label: "Fixture", ...config, cwd: root }]), model: "outcome-fixture/controlled", config: parsePrkConfig({ memory: { review: false }, session: { workerTools: "direct" } }) }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
    await prepareGatewayEnvironment(host, root, "fixture");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const { session: { sessionId: worker } } = await client.request("createSession", { target: "fixture" });
    const history = host.session(worker);
    for (let turn = 0; turn < 55; turn++) {
      provider.setResponses([fauxAssistantMessage(`seed reply ${turn}`)]);
      const run = await history.submit({ requestId: `seed-${turn}`, message: `seed message ${turn}` });
      assert.equal(run.accepted, true);
      assert.equal((await run.completion).status, "completed");
    }
    const state = () => client.request("state", { sessionId: worker });
    const terminal = (id) => until(async () => (await state()).recentOperations.find((item) => item.operationId === id), "completion");
    web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const pageReads = [];
    page.on("response", (response) => { if (new URL(response.url()).pathname.endsWith("/history-page")) pageReads.push(response.status()); });
    await page.goto(ui.url);
    await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
    const send = async (message) => {
      await page.locator("#composer").fill(message);
      const response = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/send"));
      await page.locator("#send-message").click();
      return (await (await response).json()).operationId;
    };
    const assertRerunActions = async (text) => {
      const row = page.locator(".pi-message-user").filter({ hasText: text });
      await row.locator('[data-action="copy-message"]').waitFor({ state: "attached" });
      for (const action of ["retry-message", "edit-message"]) {
        const button = row.locator(`[data-action="${action}"]:enabled`);
        try { await button.waitFor({ state: "attached", timeout: 5000 }); }
        catch (error) { throw new Error(`${text}: ${action} not enabled; entryId=${await row.getAttribute("data-entry-id")}; history-page responses=${pageReads}`, { cause: error }); }
      }
    };
    await page.locator(".pi-message-user[data-entry-id]").filter({ hasText: "seed message 54" }).waitFor();
    assert.equal(await page.locator(".pi-message-user[data-entry-id]").count(), 50, "latest page omits older turns");
    const streamed = new Set();
    client.onEvent((event, name) => { if (name === worker && event.type === "message" && event.text) streamed.add(event.operationId); });
    await client.request("subscribe", { sessionId: worker });
    const abortBeforeDelta = () => {
      provider.setResponses([(_context, { signal }) => {
        const aborted = fauxAssistantMessage("", { stopReason: "aborted" });
        if (signal.aborted) return aborted;
        return new Promise((resolve) => signal.addEventListener("abort", () => resolve(aborted), { once: true }));
      }]);
    };
    abortBeforeDelta();
    const operationId = await send("EARLY_STOP");
    await page.locator("#cancel-operation").click();
    assert.equal((await terminal(operationId)).status, "cancelled");
    assert.equal(streamed.has(operationId), false);
    await page.locator('.pi-operation-outcome[data-status="cancelled"]').waitFor();
    await assertRerunActions("EARLY_STOP");

    let held;
    await page.route("**/send", async (route) => { held = { route, response: await route.fetch() }; }, { times: 1 });
    abortBeforeDelta();
    await page.locator("#composer").fill("BEFORE_ADMISSION_STOP");
    await page.locator("#send-message").click();
    const { route, response } = await until(() => held, "held HTTP admission response");
    const admission = await response.json();
    assert.equal(admission.accepted, true);
    try {
      await page.locator("#cancel-operation").click();
      assert.equal((await terminal(admission.operationId)).status, "cancelled");
      assert.equal(streamed.has(admission.operationId), false);
      await assertRerunActions("BEFORE_ADMISSION_STOP");
    } finally { await route.fulfill({ response }); }
    await page.waitForFunction(() => document.querySelector("#composer")?.value === "");

    provider.setResponses([fauxAssistantMessage("OK")]);
    assert.equal((await terminal(await send("NORMAL_REPLY"))).status, "completed");
    await assertRerunActions("NORMAL_REPLY");

    provider.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "fixture provider error" })]);
    assert.equal((await terminal(await send("PROVIDER_ERROR"))).status, "failed");
    await assertRerunActions("PROVIDER_ERROR");
  });
} finally { await rm(root, { recursive: true, force: true }); }
console.log("PASS: persisted user actions after stop, normal completion and provider error");
