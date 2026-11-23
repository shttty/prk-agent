// One real SDK/Gateway/HTTP/Vite/Chromium scenario; only model responses and extension data are controlled.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { listKernelProcesses } from "./target-instances/list-kernel-processes.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { installToolBodyFixture, prepareArtifactFixture, realToolBodies, toolArtifacts } from "../fixtures/tool-content-scenarios.mjs";
import { checkLazyProjection } from "./lazy-tool-content/check-lazy-projection.mjs";
import { checkLazyBrowserContent } from "./lazy-tool-content/check-lazy-browser-content.mjs";
import { writeLazyProbe } from "./lazy-tool-content/write-lazy-probe.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, label, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await check(); if (value) return value; await delay(25); }
  throw new Error(`Timed out: ${label}`);
}
const bytes = (value) => Buffer.byteLength(value, "utf8");
const text = (value) => (value?.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const rowCount = (value) => value.split("\n").length;
const largeText = (label) => Array.from({ length: 1024 }, (_, i) => `${label} ${String(i).padStart(4, "0")} ${"abcdefghij".repeat(12)}`).join("\n") + `\n${label}_FULL_TAIL_Ω`;
const outputA = largeText("LAZY_A");
const outputB = largeText("LAZY_B");
const partialA = outputA.slice(0, 65_000);
const inputA = Array.from({ length: 100 }, (_, i) => `# lazy input ${i} ${"q".repeat(100)}`).join("\n") + "\n# LAZY_INPUT_FULL_TAIL_Ω";
const smallOutput = "LAZY_SMALL_COMPLETE";
const largeArgs = { code: inputA };
const ids = { a: "lazy:a/one?x=1&y=2", b: "lazy:b/two", small: "lazy:small", edit: "lazy:edit/diff" };
const callsOf = (messages) => messages.flatMap((message) => message.role === "assistant" && Array.isArray(message.content) ? message.content.filter((part) => part.type === "toolCall") : []);
const resultOf = (messages, id) => messages.find((message) => message.role === "toolResult" && message.toolCallId === id);
function preview(descriptor, full, label) {
  assert(descriptor, `${label} has a lazy descriptor`);
  assert.equal(descriptor.bytes, bytes(full), `${label} counts UTF-8 bytes, not JS characters`);
  assert.equal(descriptor.lines, rowCount(full), `${label} reports the full line count`);
  assert.equal(typeof descriptor.version, "string");
  assert(descriptor.version.length > 0);
  assert(descriptor.preview.length > 0 && full.startsWith(descriptor.preview), `${label} is an exact leading preview`);
  assert(bytes(descriptor.preview) <= 2048 && rowCount(descriptor.preview) <= 20, `${label} preview is bounded`);
  assert(descriptor.preview.length < full.length);
}

const root = await mkdtemp(join(tmpdir(), "prk-lazy-tool-"));
const shots = process.env.PI_TEST_WEB_EVIDENCE || join(root, "shots");
let host, gateway, client, web, ui, browser, releasePath;
const pageerrors = [];
await withTargetFixture(async ({ config }) => {
  try {
    const { agentDir } = initializePrkHome(root);
    const historyDir = join(root, "history");
    releasePath = join(root, "release-large-tool");
    await mkdir(join(agentDir, "extensions"), { recursive: true });
    await mkdir(shots, { recursive: true });
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
    await writeLazyProbe({ agentDir, outputA, outputB, partialA, releasePath, smallOutput });
    await installToolBodyFixture(agentDir);
    const oldFile = Array.from({ length: 70 }, (_, i) => `key_${i}: old_${"x".repeat(140)}`).join("\n");
    const newFile = oldFile.replaceAll("old_", "new_");
    await writeFile(join(root, "lazy-diff.yml"), oldFile);
    const editArgs = { path: "lazy-diff.yml", edits: [{ oldText: oldFile, newText: newFile }] };
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "lazy-tool-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    runtime.registerNativeProvider(provider.provider);
    const contexts = [];
    const steps = [
      fauxAssistantMessage(fauxToolCall("lazy_large", largeArgs, { id: ids.a }), { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("lazy_render", { code: "small renderer input" }, { id: ids.b }), { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("lazy_small", { code: "small input" }, { id: ids.small }), { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("edit", editArgs, { id: ids.edit }), { stopReason: "toolUse" }),
      fauxAssistantMessage("LAZY_SCENARIO_COMPLETE"),
    ];
    const prkConfig = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { workerTools: "direct", localTools: true, noExtensions: false, idleTimeoutMs: 60000 }, targetCacheRoot: join(root, "target-cache"), codemode: { binChunkBytes: 8 }, artifacts: { maxUploadBytes: 1024 } });
    // The legacy artifact import must precede Gateway startup, while its asset store is still cold.
    const artifacts = await prepareArtifactFixture(root, prkConfig);
    const options = { cwd: root, home: root, historyDir, targets: parseTargets([{ id: "fixture", label: "Artifact fixture", tags: [], ...config, cwd: root }]), model: "lazy-tool-controlled/controlled", config: prkConfig };
    const dependencies = { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } };
    host = await createGatewayHost(options, dependencies);
    const socket = join(root, "g.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const created = await client.request("createSession", { target: "fixture", label: "Lazy content fixture" });
    const name = created.session.sessionId;
    const sessionId = created.snapshot.sessionId;
    web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    const http = async (path) => {
      const response = await fetch(`${web.server.url}/api/sessions/${encodeURIComponent(name)}/${path}`, { signal: AbortSignal.timeout(15000) });
      return { status: response.status, body: await response.json() };
    };
    const contentPath = (id) => `tool-content?${new URLSearchParams({ toolCallId: id })}`;
    const fetchFull = async (id) => { const response = await http(contentPath(id)); assert.equal(response.status, 200); assert.equal(response.body.sessionId, sessionId); assert.equal(response.body.toolCallId, id); return response.body; };
    const events = [];
    client.onEvent((event, source) => { if (source === name) events.push(event); });
    await client.request("subscribe", { sessionId: name });
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] });
    await realToolBodies({ host, client, ui, browser, provider });
    await toolArtifacts({ home: root, host, client, web, ui, browser, provider, ...artifacts });
    provider.setResponses(steps.map((step) => (context) => { contexts.push(structuredClone(context)); return step; }));
    const context = await browser.newContext({ viewport: { width: 1440, height: 3000 }, colorScheme: "light", permissions: ["clipboard-read", "clipboard-write"] });
    await context.addInitScript(() => { if (location.protocol === "http:" || location.protocol === "https:") localStorage.setItem("pi-session-theme", "light"); });
    context.on("page", (page) => page.on("pageerror", (error) => pageerrors.push(error.message)));
    const page = await context.newPage();
    const requests = [];
    context.on("request", (request) => { if (new URL(request.url()).pathname.endsWith("/tool-content")) requests.push(new URL(request.url())); });
    const tool = (target, id) => target.locator(`[data-tool-key$=${JSON.stringify(`:${id}`)}]`);
    const select = async (target) => {
      if (await target.locator("#open-sidebar").isVisible()) await target.locator("#open-sidebar").click();
      await target.locator(`[data-session-id=${JSON.stringify(name)}] .management-session-select`).click();
      await target.locator("#composer").waitFor();
    };
    const openAncestors = async (row) => {
      await row.evaluate((node) => { for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true; });
    };
    const expand = async (row) => {
      await openAncestors(row);
      if (!await row.evaluate((node) => node.open)) await row.locator(":scope > summary").click();
      // Input and output retain their own native folds; both hydrate from the same deduplicated row request.
      for (let folds = 0; folds < 4; folds++) {
        const button = row.locator('[data-action="expand-lines"]').first();
        if (!await button.count()) break;
        await button.click();
        await until(async () => await row.getAttribute("data-content-state") === "loaded", "row hydration");
      }
      assert.equal(await row.locator('[data-action="expand-lines"]').count(), 0, "all input/output lines are expanded");
    };
    await page.goto(ui.url);
    await select(page);
    assert.equal(requests.length, 0, "arrival and session selection do not prefetch tool content");
    const { snapshot, fullA, fullEdit } = await checkLazyProjection({ host, name, until, events, ids, preview, partialA, largeArgs, fetchFull, text, releasePath, client, callsOf, inputA, resultOf, outputA, outputB, smallOutput, http, contentPath, sessionId, root, historyDir, contexts, page, bytes });
    await checkLazyBrowserContent({ tool, page, ids, requests, openAncestors, bytes, rowCount, outputA, shots, expand, until, fullA, fullEdit, resultOf, snapshot, context, ui, select, pageerrors });
    await browser.close(); browser = undefined;
    await ui.close(); ui = undefined;
    await web.close(); web = undefined;
    await client.disconnect(); client = undefined;
    await gateway.close(); gateway = undefined;
    host = await createGatewayHost(options, dependencies);
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0 });
    const kernels = () => listKernelProcesses(config.python, root);
    const asleepKernels = await kernels();
    const modelCalls = provider.state.callCount;
    assert.equal(host.state(name).state, "sleeping");
    assert.deepEqual(await fetchFull(ids.a), fullA, "sleeping history serves the full call through the SDK manager");
    assert.equal(host.state(name).state, "sleeping");
    assert.deepEqual(await kernels(), asleepKernels, "full reads do not allocate a sleeping kernel");
    await client.request("closeSession", { sessionId: name });
    assert.equal(host.state(name).state, "closed");
    assert.deepEqual(await fetchFull(ids.a), fullA, "closed history still serves full content");
    assert.equal(host.state(name).state, "closed");
    await client.request("archiveSession", { sessionId: name, confirm: true });
    assert(host.workbench().archive.some((entry) => entry.group === name));
    assert.deepEqual(await fetchFull(ids.a), fullA, "archived read-only history serves full content");
    assert(!host.workbench().sessions.some((entry) => entry.sessionId === name));
    assert.deepEqual(await kernels(), asleepKernels, "inactive and archived reads never wake a kernel");
    assert.equal(provider.state.callCount, modelCalls, "content reads never invoke the model");
    console.log(JSON.stringify({ pageerrorCount: pageerrors.length, screenshots: [join(shots, "lazy-tool-collapsed-light.png"), join(shots, "lazy-tool-expanded-light.png")] }));
    console.log("PASS lazy tool content: snapshot/live projection, full API/SDK/model, expand/cache/copy/search/diff/nested, inactive/archive reads");
  } finally {
    if (releasePath) await writeFile(releasePath, "release").catch(() => {});
    await browser?.close(); await ui?.close(); await web?.close(); await client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  }
});
