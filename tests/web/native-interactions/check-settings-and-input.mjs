// The UI dev server outlives every API restart below; the API always comes
  // back on this port, which is where the UI's /api proxy points.
// Browser fetch is used only to seed fixtures or observe Gateway-owned state.
  // User mutations below are performed through visible desktop/touch controls.
// Every worker keeps settings in memory; switches live in session details, not the slash menu.
// Resource status and reload moved from the removed session-tools panel into 会话详情.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { startWebDev } from "../../fixtures/web-dev.mjs";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { parseTargets } from "../target-instances/parse-targets.mjs";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function checkSettingsAndInput(ctx) {
Object.defineProperties(ctx, {
    evidence: { configurable: true, get: () => evidence },
    web: { configurable: true, get: () => web, set: (value) => { web = value; } },
    ui: { configurable: true, get: () => ui, set: (value) => { ui = value; } },
    target: { configurable: true, get: () => target },
    modelCalls: { configurable: true, get: () => modelCalls, set: (value) => { modelCalls = value; } },
    socket: { configurable: true, get: () => socket },
    apiPort: { configurable: true, get: () => apiPort },
    desktop: { configurable: true, get: () => desktop },
    phone: { configurable: true, get: () => phone },
    api: { configurable: true, get: () => api },
    json: { configurable: true, get: () => json },
    state: { configurable: true, get: () => state },
    main: { configurable: true, get: () => main },
    repeatedText: { configurable: true, get: () => repeatedText },
    repeatedRequests: { configurable: true, get: () => repeatedRequests, set: (value) => { repeatedRequests = value; } },
    countRepeatedSend: { configurable: true, get: () => countRepeatedSend },
});

const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "pi-native-web-evidence-"));

await mkdir(evidence, { recursive: true });

const historyDir = join(ctx.root, "history");

const targetRoot = ctx.tempRoot;

await mkdir(join(targetRoot, "folder", "nested"), { recursive: true });

await writeFile(join(targetRoot, "fixture.py"), "ROOT_SENTINEL = 41\n", "utf8");

await writeFile(join(targetRoot, "fixture.js"), "const JAVASCRIPT_SENTINEL = 42;\n", "utf8");

await writeFile(join(targetRoot, "folder", "nested", "fixture.txt"), "NESTED_SENTINEL\n", "utf8");

let host;

let gateway;

let web;

let ui;

let browser;

const [target] = parseTargets([{ id: "fixture-target", label: "Native fixture target", tags: [], ...ctx.config, cwd: targetRoot }]);

const runtime = await ctx.ModelRuntime.create({ authPath: join(ctx.agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });

const faux = ctx.fauxProvider({ provider: "native-web-controlled", models: [{ id: "controlled", reasoning: true }, { id: "alternate" }], tokensPerSecond: 20 });

runtime.registerNativeProvider(faux.provider);

let modelCalls = 0;

faux.setResponses(Array.from({ length: 500 }, (_, index) => async (context) => {
    modelCalls++;
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return ctx.fauxAssistantMessage("NATIVE_TOOL_DONE");
    if (last?.role === "user" && JSON.stringify(last.content).includes("NATIVE_TOOL_PROOF")) return ctx.fauxAssistantMessage(ctx.fauxToolCall("kernel_code", { code: "import time\nnative_retained_value = 41\ntime.sleep(3)\nprint('NATIVE_KERNEL_READY', native_retained_value, flush=True)" }), { stopReason: "toolUse" });
    if (last?.role === "user" && JSON.stringify(last.content).includes("NATIVE_QUEUED_PROOF")) return ctx.fauxAssistantMessage("NATIVE_QUEUED_DONE");
    const prompt = JSON.stringify(context?.messages?.at(-1)?.content || []);
    const long = /ordinary cancellation branch|touch busy proof/.test(prompt);
    return ctx.fauxAssistantMessage(`Controlled response ${index}: ${"working ".repeat(long ? 400 : 80)}`);
  }));

const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: ctx.root, agentDir: ctx.agentDir } };

const hostOptions = { cwd: ctx.root, home: ctx.root, config: parsePrkConfig({ targetCacheRoot: join(ctx.root, "target-cache"), session: { workerTools: "direct" } }), historyDir, model: "native-web-controlled/controlled", thinkingLevel: "off", targets: [target] };

const socket = join(ctx.root, "gateway.sock");

ctx.onCleanup(async () => {
    await Promise.allSettled([browser?.close()]);
    await Promise.allSettled([ui?.close(), web?.close(), gateway?.close(), host?.close()]);
  });

host = await ctx.createGatewayHost(hostOptions, dependencies);

await prepareGatewayEnvironment(host, ctx.root, target.id);

gateway = await ctx.startGateway(host, socket);

web = await ctx.startWebApplication({ socket, host: "127.0.0.1", port: 0 });

const apiPort = Number(new URL(web.server.url).port);

ui = await startWebDev(web.server.url);

browser = await ctx.chromium.launch({ executablePath: ctx.CHROMIUM, headless: true, args: ["--no-sandbox"] });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const page of [desktop, phone]) {
    page.setDefaultTimeout(20_000);
    await page.goto(ui.url, { waitUntil: "domcontentloaded" });
    await page.locator("#app-shell").waitFor();
  }

const api = async (page, path, options = {}) => page.evaluate(async ({ path: requestPath, options: requestOptions }) => {
    const response = await fetch(requestPath, { ...requestOptions, headers: { Accept: "application/json", ...(requestOptions.body ? { "Content-Type": "application/json" } : {}), ...(requestOptions.headers || {}) } });
    return {
      status: response.status, body: await (async () => {
      const text = await response.text();
      try { return text ? JSON.parse(text) : {}; } catch { return { text }; }
      })()
    };
  }, { path, options });

const json = (value) => JSON.stringify(value);

const state = async (page, sessionId) => {
    const response = await api(page, `/api/sessions/${encodeURIComponent(sessionId)}`);
    assert.equal(response.status, 200, `state for ${sessionId}`);
    return response.body;
  };

const mainResponse = await api(desktop, "/api/sessions", { method: "POST", body: json({ target: "fixture-target", label: "Native coordinator fixture" }) });

assert.equal(mainResponse.status, 201, "worker fixture setup");

const main = mainResponse.body.session.sessionId;

await ctx.selectSession(desktop, main);

const beforeSettings = (await state(desktop, main)).messages;

await desktop.locator("#chat-thinking-select").click();

await desktop.locator('[role="option"][value="low"]').click();

await ctx.waitForObservation(desktop, async (name) => (await (await fetch(`/api/sessions/${name}`)).json()).thinkingLevel === "low", main, { timeout: 10_000 });

await desktop.waitForFunction(() => document.querySelector("#chat-thinking-select")?.disabled === false);

assert.equal(await desktop.locator(".pi-native-interaction-card").count(), 0, "thinking picker does not create a running or completed chat message");

const nativeRoute = `**/api/sessions/${main}/native*`;

await desktop.route(nativeRoute, async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || request.postDataJSON()?.action !== "thinking") return route.continue();
    const { requestId } = request.postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: json({ requestId, action: "thinking", status: "failed", message: "CONTROL_SETTING_REJECTED" }) });
  });

await desktop.locator("#chat-thinking-select").click();

await desktop.locator('[role="option"][value="high"]').click();

await desktop.locator("#chat-error").getByText("CONTROL_SETTING_REJECTED", { exact: true }).waitFor({ state: "visible" });

assert.equal(await desktop.locator(".pi-native-interaction-card").count(), 0, "failed picker changes show an error, not a ghost chat message");

assert.equal((await state(desktop, main)).thinkingLevel, "low", "rejected change preserves the applied thinking level");

await desktop.unroute(nativeRoute);

const availableModels = await api(desktop, "/api/models");

const alternate = availableModels.body.models.find((model) => model.value === "native-web-controlled/alternate");

await desktop.locator("#chat-model-select").click();

await desktop.locator(`[role="option"][value=${JSON.stringify(alternate.value)}]`).click();

await ctx.waitForObservation(desktop, async (name) => (await (await fetch(`/api/sessions/${name}`)).json()).model === "native-web-controlled/alternate", main, { timeout: 10_000 });

await desktop.waitForFunction(() => document.querySelector("#chat-model-select")?.disabled === false);

assert.equal(await desktop.locator(".pi-native-interaction-card").count(), 0, "model picker does not add a chat message");

assert.deepEqual((await state(desktop, main)).messages, beforeSettings, "picker controls do not mutate conversation messages");

const cardsBeforeSettings = await desktop.locator(".pi-native-interaction-card").count();

await ctx.chooseSessionMenuItem(desktop, "session-details");

const mainDetails = desktop.getByRole("dialog").filter({ has: desktop.locator("#session-usage") });

await mainDetails.locator('#session-usage [data-metric="cumulative-tokens"]').waitFor({ state: "visible" });

await desktop.waitForFunction(() => document.querySelector("#setting-autoRetry")?.disabled === false);

const retryBefore = await mainDetails.locator("#setting-autoRetry").isChecked();

const settingsPending = desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "settings" && response.request().postDataJSON()?.args?.autoRetry !== undefined);

await mainDetails.locator("#setting-autoRetry").click();

const settingsResponse = await ctx.readJsonResponse(await settingsPending);

assert.equal(settingsResponse.status, "completed", "settings switch uses the native settings action");

assert.equal(settingsResponse.data?.autoRetry, !retryBefore, "settings switch flips the SDK value");

assert.equal(settingsResponse.data?.scope, "current-session", "Settings stay on the current session");

await desktop.waitForFunction((expected) => document.querySelector("#setting-autoRetry")?.checked === expected && document.querySelector("#setting-autoRetry")?.disabled === false, !retryBefore);

const reloadButton = mainDetails.locator("#reload-resources");

await reloadButton.waitFor({ state: "visible" });

await desktop.waitForFunction(() => document.querySelector("#reload-resources")?.disabled === false);

const reloadPending = desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "reload");

await reloadButton.click();

assert.equal((await ctx.readJsonResponse(await reloadPending)).status, "completed", "reload from 会话详情 completes");

await mainDetails.locator("#close-session-details").click();

await desktop.locator("#session-id").waitFor({ state: "hidden" });

assert.equal(await desktop.locator(".pi-native-interaction-card").count(), cardsBeforeSettings, "settings switches add no chat card");

const repeatedText = "repeat user bubble regression";

let repeatedRequests = 0;

const countRepeatedSend = (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === `/api/sessions/${main}/send` && request.postDataJSON()?.message === repeatedText) repeatedRequests++;
  };

desktop.on("request", countRepeatedSend);

}
