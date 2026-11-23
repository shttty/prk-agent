import { stringify } from "smol-toml";
// REPL processes observed in /proc (real processes under the fixture directory): the external authority
  // for "which runtimes exist" across every restart and shutdown below.
// The Gateway/Agent host owns every session and kernel; the web process below
  // only ever talks to this private socket.
// url() is the API listener, used for direct HTTP boundary checks. Pages open
  // the separate web/ dev server, which proxies /api to that listener.
// Node fetch normalizes Host; use native HTTP to test an actual hostile header.
// Observe Chromium's received SSE messages without replacing any page API.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { listKernelProcesses } from "../target-instances/list-kernel-processes.mjs";
import { startWebDev } from "../../fixtures/web-dev.mjs";

export async function assembleBrowserWorkbench(ctx) {
Object.defineProperties(ctx, {
    root: { configurable: true, get: () => root },
    sentinel: { configurable: true, get: () => sentinel },
    workbenchTempRoot: { configurable: true, get: () => workbenchTempRoot },
    names: { configurable: true, get: () => names },
    bodies: { configurable: true, get: () => bodies },
    errors: { configurable: true, get: () => errors },
    browser: { configurable: true, get: () => browser, set: (value) => { browser = value; } },
    page: { configurable: true, get: () => page, set: (value) => { page = value; } },
    phone: { configurable: true, get: () => phone, set: (value) => { phone = value; } },
    mobile: { configurable: true, get: () => mobile, set: (value) => { mobile = value; } },
    host: { configurable: true, get: () => host, set: (value) => { host = value; } },
    endpoint: { configurable: true, get: () => endpoint, set: (value) => { endpoint = value; } },
    webProcess: { configurable: true, get: () => webProcess, set: (value) => { webProcess = value; } },
    ui: { configurable: true, get: () => ui, set: (value) => { ui = value; } },
    emptyHost: { configurable: true, get: () => emptyHost, set: (value) => { emptyHost = value; } },
    emptyEndpoint: { configurable: true, get: () => emptyEndpoint, set: (value) => { emptyEndpoint = value; } },
    emptyApplication: { configurable: true, get: () => emptyApplication, set: (value) => { emptyApplication = value; } },
    emptyUi: { configurable: true, get: () => emptyUi, set: (value) => { emptyUi = value; } },
    ids: { configurable: true, get: () => ids },
    sessionKernels: { configurable: true, get: () => sessionKernels },
    baseline: { configurable: true, get: () => baseline },
    sentinelIds: { configurable: true, get: () => sentinelIds },
    faux: { configurable: true, get: () => faux },
    runtimeDependencies: { configurable: true, get: () => runtimeDependencies },
    socket: { configurable: true, get: () => socket },
    url: { configurable: true, get: () => url },
    apiPort: { configurable: true, get: () => apiPort },
    request: { configurable: true, get: () => request },
    desktop: { configurable: true, get: () => desktop },
    delivered: { configurable: true, get: () => delivered },
    browserNetwork: { configurable: true, get: () => browserNetwork },
    watchErrors: { configurable: true, get: () => watchErrors },
    snapshot: { configurable: true, get: () => snapshot },
    httpSnapshot: { configurable: true, get: () => httpSnapshot },
    sendOn: { configurable: true, get: () => sendOn },
    send: { configurable: true, get: () => send },
    openCreation: { configurable: true, get: () => openCreation },
    connectedOn: { configurable: true, get: () => connectedOn },
    connected: { configurable: true, get: () => connected },
});

const root = await mkdtemp(join(tmpdir(), "pi-web-browser-"));

const sentinel = createPythonTool({ ...ctx.runtime, target: "web-sentinel" });

const workbenchTempRoot = ctx.tempRoot;

assert(workbenchTempRoot, "The owned target fixture provides the workbench directory");

const names = new Map();

const bodies = [];

const errors = [];

let browser, page, phone, mobile;

let host, endpoint, webProcess, ui;

let emptyHost, emptyEndpoint, emptyApplication, emptyUi;

ctx.onCleanup(async () => {
    if (browser?.isConnected() && page && !page.isClosed()) {
      await page.screenshot({ path: join(ctx.evidence, "last-browser-state.png"), fullPage: true, animations: "disabled", timeout: 5000 }).catch(() => {});
      let observed = "unavailable";
      try { observed = host?.session(names.get("first"))?.getSnapshot(); } catch { /* The Gateway may already be shut down. */ }
      await writeFile(join(ctx.evidence, "last-browser-state.json"), JSON.stringify({
        text: await page.locator("body").textContent().catch(() => "unavailable"),
        routing: Object.fromEntries(names),
        snapshot: observed,
        pageErrors: errors,
      }, null, 2)).catch(() => {});
    }
    const results = await Promise.allSettled([
      browser?.close(),
      emptyUi?.close(), ui?.close(),
      emptyApplication?.close(), emptyEndpoint?.close(),
      ctx.stopWebProcess(webProcess),
      endpoint ? endpoint.close() : host?.close(),
      sentinel.close(),
    ]);
    await rm(root, { recursive: true, force: true });
    const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
    if (failures.length) throw new AggregateError(failures, "Web verification cleanup failed");
  });

const ids = () => listKernelProcesses(ctx.config.python, workbenchTempRoot);

// One session's REPL processes: every session here has its own cwd below the workbench directory.
const sessionKernels = (directory) => listKernelProcesses(ctx.config.python, join(workbenchTempRoot, directory));

const baseline = await ids();

await sentinel.tool.execute("sentinel", { code: "sentinel_value = 73" }, ctx.signal);

const sentinelIds = await ids();

assert.equal(sentinelIds.length, baseline.length + 1, "An unrelated sentinel REPL exists for isolation evidence");

const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });

const faux = fauxProvider({ provider: "web-browser-controlled", models: [{ id: "controlled" }], tokensPerSecond: 400 });

modelRuntime.registerNativeProvider(faux.provider);

faux.setResponses(Array.from({ length: 400 }, () => async (context) => {
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("# Markdown 测试\n\n- 项目一\n- 项目二\n\n`代码` 和 **粗体**。\n\n```python\nprint('<safe>')\n```\n\n| 列 | 值 |\n| --- | --- |\n| A | B |\n\n[安全链接](https://example.com) [危险链接](javascript:alert(1))\n\n<img src=x onerror=alert(1)><script>alert(1)</script>\n\n执行完成：请查看上面的实际 Python 输出。这是受控响应，不是真实外部模型验收。");
    const code = /```python\n([\s\S]*?)\n```/.exec(ctx.text(last))?.[1];
    assert(code, "Controlled browser provider expects explicit Python code");
    return fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" });
  }));

const runtimeDependencies = { model: faux.getModel(), modelRuntime, thinkingLevel: "low", cwd: root, agentDir: root };

await mkdir(root, { recursive: true });

await mkdir(join(workbenchTempRoot, "session-one"), { recursive: true });

await mkdir(join(workbenchTempRoot, "session-two"), { recursive: true });

await writeFile(join(root, "config.toml"), stringify({ session: { workerTools: "direct" } }));

await writeFile(join(root, "instances.toml"), stringify({ instances: [{ id: "alpha", label: "Alpha instance", tags: [], ...ctx.config, cwd: workbenchTempRoot }] }), { mode: 0o600 });

host = await createGatewayHost(
    { cwd: root, home: root, model: "web-browser-controlled/controlled" },
    { runtimeDependencies },
  );

const socket = join(root, "gateway.sock");

endpoint = await startGateway(host, socket);

webProcess = await ctx.startWebProcess(socket);

const url = () => webProcess.url;

const apiPort = Number(new URL(url()).port);

ui = await startWebDev(url(), { host: ctx.webHost });

assert.deepEqual(host.workbench().sessions, [], "The Gateway starts with no worker session");

assert.deepEqual(await ids(), sentinelIds, "Starting the Gateway and the web adapter starts no REPL");

const request = (path, body, headers = {}, method = body === undefined ? "GET" : "POST") => new Promise((resolveRequest, reject) => {
    const outgoing = httpRequest(`${url()}${path}`, {
      method, headers: { "Content-Type": "application/json", Origin: url(), ...headers }, signal: AbortSignal.timeout(20_000),
    }, (incoming) => {
      let data = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { data += chunk; });
      incoming.once("error", reject);
      incoming.once("end", () => { bodies.push(data); resolveRequest({ status: incoming.statusCode, headers: incoming.headers, text: async () => data }); });
    });
    outgoing.once("error", reject);
    outgoing.end(body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body));
  });

browser = await ctx.chromium.launch({ executablePath: ctx.executablePath, headless: true });

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

const browserOrigin = ui.url;

await desktop.grantPermissions(["clipboard-read", "clipboard-write"], { origin: browserOrigin });

page = await desktop.newPage();

const delivered = [];

const browserNetwork = await desktop.newCDPSession(page);

browserNetwork.on("Network.eventSourceMessageReceived", ({ eventName, data }) => {
    if (eventName !== "host") return;
    try { delivered.push(JSON.parse(data)); }
    catch (error) { errors.push(`Invalid host SSE JSON: ${error.message}`); }
  });

await browserNetwork.send("Network.enable");

const watchErrors = (target) => target.on("pageerror", (error) => errors.push(error.message));

watchErrors(page);

const snapshot = (key = "first") => host.session(names.get(key)).getSnapshot();

const httpSnapshot = async (key) => {
    const response = await fetch(`${url()}/api/sessions/${encodeURIComponent(names.get(key))}`, { headers: { Origin: url() } });
    assert.equal(response.status, 200);
    const body = await response.text();
    bodies.push(body);
    return JSON.parse(body);
  };

const sendOn = async (currentPage, code) => {
    await currentPage.locator("#composer").fill(ctx.prompt(code));
    await currentPage.locator("#send-message").click();
  };

const send = async (code) => sendOn(page, code);

const openCreation = async (target) => {
    const label = host.workbench().targets.find((entry) => entry.id === target)?.label || target;
    await page.locator(`button[data-action="create-session"][data-target=${JSON.stringify(target)}]`).click();
    return page.locator('#management-dialog[data-kind="create"]');
  };

const connectedOn = (currentPage, name) => currentPage.waitForFunction(
    (title) => document.querySelector("#topbar-title")?.textContent === title && document.querySelector("#composer") && !document.querySelector("#composer").disabled && !document.querySelector("#composer").readOnly,
    host.workbench().sessions.find((worker) => worker.sessionId === name).label,
  );

const connected = (name) => connectedOn(page, name);

}
