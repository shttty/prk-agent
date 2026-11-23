import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { writeRendererFixture } from "./extension-ui/write-renderer-fixture.mjs";
import { checkHostedControls } from "./extension-ui/check-hosted-controls.mjs";
import { checkRenderingSeams } from "./extension-ui/check-rendering-seams.mjs";
import { checkBrowserView } from "./extension-ui/check-browser-view.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const webTheme = JSON.parse(await readFile(join(repo, "shared/pi-web-theme.json"), "utf8"));
const marker = (token) => `\u001b[38;5;${webTheme.colors[token]}m`;
const root = await mkdtemp(join(tmpdir(), "prk-ui-"));
try {
const { agentDir } = initializePrkHome(root);
await mkdir(agentDir, { recursive: true });
const cc = process.argv.includes("--cc");
const ccPackage = process.env.PI_TEST_CC_PACKAGE;
if (cc && !ccPackage) throw new Error("--cc requires PI_TEST_CC_PACKAGE pointing to an isolated installed pi-cc-extensions@1.0.1.");
const themeDir = process.env.PI_TEST_UI_THEMES || (ccPackage && join(ccPackage, "themes"));
if (themeDir) {
  await mkdir(join(agentDir, "themes"), { recursive: true });
  for (const name of ["cc-dark", "cc-light"]) await copyFile(join(themeDir, `${name}.json`), join(agentDir, "themes", `${name}.json`));
}
await writeFile(join(agentDir, "settings.json"), JSON.stringify({
  packages: [join(repo, "tests/fixtures/pi-ui-probe"), ...(cc ? [ccPackage] : [])].map((source) => ({ source, enabled: true, location: "gateway" })), theme: themeDir ? "cc-dark" : "dark",
  compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 },
}));
await mkdir(join(agentDir, "extensions"), { recursive: true });
await writeFile(join(agentDir, "keybindings.json"), JSON.stringify({ "app.interrupt": ["ctrl+g"] }));
await writeRendererFixture(agentDir);

const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { startWebApplication } = await import("../../src/http/application/start-application.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { parseTargets } = await import("./target-instances/parse-targets.mjs");
const { startWebDev } = await import("../fixtures/web-dev.mjs");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(read, predicate, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  do { const value = await read(); if (predicate(value)) return value; await delay(30); } while (Date.now() < deadline);
  throw new Error(`Timed out: ${message}`);
}

  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    let host, gateway, client, web, ui, browser;
    onCleanup(async () => {
      await browser?.close();
      await client?.disconnect();
      await ui?.close();
      await web?.close();
      if (gateway) await gateway.close(); else await host?.close();
    });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const faux = fauxProvider({ provider: "extension-ui-controlled", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(faux.provider);
    let modelCalls = 0;
    faux.setResponses(Array.from({ length: 100 }, () => (context) => {
      modelCalls++;
      const last = context.messages.at(-1);
      if (last?.role === "toolResult") return fauxAssistantMessage("PROBE_TOOL_DONE");
      return fauxAssistantMessage("PROBE_REPLY");
    }));
    host = await createGatewayHost({
      cwd: root, home: root, historyDir: join(root, "history"), model: "extension-ui-controlled/controlled", thinkingLevel: "off",
      config: parsePrkConfig({ targetCacheRoot: join(root, "target-cache"), session: { noExtensions: false, noThemes: false, workerTools: "direct" } }),
      targets: parseTargets([{ id: "fixture", label: "UI fixture", tags: [], ...config, cwd: tempRoot }]),
    }, { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir } });
    await prepareGatewayEnvironment(host, root, "fixture");
    const socket = join(root, "g.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
    const main = await client.request("createSession", { target: "fixture", label: "Plugin UI coordinator" });
    const worker = await client.request("createSession", { target: "fixture", label: "Plugin UI worker" });
    let counter = 0;
    const action = (name, args) => client.request("nativeAction", { sessionId: name, requestId: `ui-${++counter}`, action: "extension-ui", args });
    const render = async (name, width = 80, clientId = "desktop") => {
      const response = await action(name, { operation: "render", width, height: 40, clientId });
      assert.equal(response.status, "completed", response.message);
      return response.data;
    };
    const send = (name, message) => host.session(name).submit({ requestId: `probe-${++counter}`, message });
    const command = async (name, value) => { const submission = await send(name, `/probe ${value}`); assert.equal(submission.accepted, true); assert.equal((await submission.completion).status, "completed"); };
    const events = await fetch(`${web.server.url}/api/sessions/${main.session.sessionId}/events`, { signal: AbortSignal.timeout(15000) });
    assert.equal(events.status, 200);
    const reader = events.body.getReader();
    const uiEvent = (async () => {
      let text = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("SSE ended before plugin UI event");
        text += new TextDecoder().decode(chunk.value);
        if (text.includes('"type":"extension_ui"')) return;
      }
    })();
    await command(main.session.sessionId, "notify");
    await uiEvent;
    await reader.cancel();
    const httpRender = await fetch(`${web.server.url}/api/sessions/${main.session.sessionId}/native`, {
      method: "POST", headers: { Origin: new URL(web.server.url).origin, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: `http-${++counter}`, action: "extension-ui", args: { operation: "render", width: 40, height: 30, clientId: "http-client" } }),
    });
    assert.equal(httpRender.status, 200);
    assert.ok((await httpRender.json()).data.notifications.some((item) => item.message === "probe info"));
    await checkHostedControls({ main, worker, host, command, render, cc, send, action, until, marker, client });
    assert.equal(modelCalls, 0, "UI-only commands never invoke a model");
    await checkRenderingSeams({ faux, send, main, worker, until, render, action, client, host, command, cc, nextCounter: () => ++counter, fauxAssistantMessage, fauxToolCall });

    if (process.argv.includes("--serve") || process.argv.includes("--browser")) {
      ui = await startWebDev(web.server.url);
      console.log(`EXTENSION_UI_READY ${ui.url} main=${main.session.sessionId} worker=${worker.session.sessionId}`);
      if (process.argv.includes("--serve")) await new Promise((done) => { process.once("SIGTERM", done); process.once("SIGINT", done); });
      else {
        const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
        browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
          await checkBrowserView({ browser, viewport, ui, main, host, faux, until, webTheme, fauxAssistantMessage, fauxToolCall });
        }
        console.log("EXTENSION UI BROWSER PASS (desktop+phone; real dialogs/native widgets/submenu/autocomplete/renderers/fallback/theme isolation)");
      }
    }
  }, { tempParent: root });
} finally { await rm(root, { recursive: true, force: true }); }
