import { stringify } from "smol-toml";
// Formal acceptance: linked local-directory plugins + owned Jupyter + actual Gateway/HTTP/Vite/Chromium.
// SHELL=/bin/bash PI_TEST_PYTHON=... PI_TEST_PLAYWRIGHT=... PI_TEST_CHROMIUM=... node tests/web/check-remote-extension-ui.mjs
import { checkRemoteDialogs } from "./remote-extension-ui/check-remote-dialogs.mjs";
import { checkPluginManagement } from "./remote-extension-ui/check-plugin-management.mjs";
import { checkRemoteCapabilityLayers } from "./remote-extension-ui/check-remote-capability-layers.mjs";
import { preparePluginDirectories } from "./remote-extension-ui/prepare-plugin-directories.mjs";
import { settingsNavigation } from "./remote-extension-ui/settings-navigation.mjs";
import { holdRemoteUi } from "./remote-extension-ui/hold-remote-ui.mjs";
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { readTargetResult } from "./remote-extension-ui/read-target-result.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { checkTargetIdentity } from "./remote-extension-ui/check-target-identity.mjs";
import { nativeAction } from "./remote-extension-ui/native-action.mjs";

for (const key of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[key]) throw new Error(`${key} is required; see docs/kernel-recovery.md.`);
}
const holdMs = Number(process.env.PRK_REMOTE_EXTENSION_HOLD_MS ?? 0);
if (!Number.isSafeInteger(holdMs) || holdMs < 0) throw new Error("PRK_REMOTE_EXTENSION_HOLD_MS must be a nonnegative integer.");
const root = await mkdtemp(join(tmpdir(), "prk-remote-ui-"));
const evidence = process.env.PRK_REMOTE_EXTENSION_EVIDENCE
  ? resolve(process.env.PRK_REMOTE_EXTENSION_EVIDENCE) : await mkdtemp(join(tmpdir(), "prk-remote-ui-evidence-"));
const marker = randomUUID();
await mkdir(evidence, { recursive: true });
const previousHome = process.env.HOME;
const previousMarker = process.env.PRK_REMOTE_UI_MARKER;
process.env.HOME = join(root, "gateway-home");
// Failed artifact preparation must release the store too, before any Jupyter/browser fixture exists.
try {
await mkdir(process.env.HOME, { recursive: true });
await prepareNativeToolArtifacts(root);
const plugins = await preparePluginDirectories(root);
process.env.PRK_REMOTE_UI_MARKER = marker;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(read, check, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`);
    await delay(30);
  }
}

  await withTargetFixture(async ({ config, tempRoot, signal, onCleanup }) => {
    const { agentDir } = initializePrkHome(root);
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always", packages: plugins.settingsPackages }), { mode: 0o600 });
    const eventLog = join(evidence, "target-events.jsonl");
    await writeFile(eventLog, "");
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
    const { startWebApplication } = await import("../../src/http/application/start-application.ts");
    const { startWebDev } = await import("../fixtures/web-dev.mjs");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    let host, gateway, client, web, ui, browser, page, inspectedWorker;
    onCleanup(async () => {
      await browser?.close();
      await client?.disconnect();
      await ui?.close();
      await web?.close();
      if (gateway) await gateway.close(); else await host?.close();
    });
    const results = [];
    try {
      const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "remote-ui-controlled", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
      modelRuntime.registerNativeProvider(provider.provider);
      const document = { monitor: { enabled: false }, memory: { review: false }, session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true, workerTools: "direct", idleTimeoutMs: 600000 } };
      const instanceDocument = { instances: [
        // Session-host plugins here need a remote target: `sh` is a connection command whose stdin/stdout is a POSIX shell (D0).
        { id: "fixture", label: "Remote UI fixture", tags: [], ...config, local: false, sshCommand: "sh", cwd: tempRoot },
      ] };
      await writeFile(join(root, "config.toml"), stringify(document));
      await writeFile(join(root, "instances.toml"), stringify(instanceDocument), { mode: 0o600 });
      host = await createGatewayHost({
        cwd: root, home: root, noSkills: true, historyDir: join(root, "history"), model: "remote-ui-controlled/controlled", thinkingLevel: "off", config: parsePrkConfig(document, instanceDocument),
      }, {
        runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir },
        onRemoteExtensionEvent: (event) => appendFileSync(eventLog, JSON.stringify(event) + "\n"),
      });
      const socket = join(root, "gateway.sock");
      gateway = await startGateway(host, socket);
      client = await connectGateway(socket);
      web = await startWebApplication({ socket, home: root, host: "127.0.0.1", port: 0 });
      ui = await startWebDev(web.server.url);
      const created = await client.request("createSession", { target: "fixture", label: "Remote extension UI" });
      const name = created.session.sessionId;
      inspectedWorker = name;
      const sessionId = created.session.sessionId;
      browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, ignoreDefaultArgs: ["--hide-scrollbars"], args: ["--no-sandbox"] });
      page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(ui.url);
      if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
      await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
      await page.locator("#composer").waitFor({ state: "visible" });
      const events = async () => (await readFile(eventLog, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
      const targetResult = (token) => readTargetResult(events, token);
      const identity = (details, turn) => checkTargetIdentity(details, turn, marker, tempRoot, sessionId);
      let counter = 0;
      const begin = async (operation, extra = {}) => {
        const args = { operation, token: `remote-ui-${++counter}`, ...extra };
        const toolCallId = `remote-ui-call-${counter}`;
        provider.setResponses([
          fauxAssistantMessage(fauxToolCall("remote_ui", args, { id: toolCallId }), { stopReason: "toolUse" }),
          fauxAssistantMessage(`REMOTE_UI_DONE:${args.token}`),
        ]);
        await until(() => host.state(name), (state) => state.state === "idle", "session ready for remote tool");
        const acceptedResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${name}/send`);
        await page.locator("#composer").fill(`REMOTE_UI ${JSON.stringify(args)}`);
        await page.locator("#send-message").click();
        const response = await acceptedResponse;
        assert.equal(response.status(), 200);
        const accepted = await response.json();
        assert.equal(accepted.accepted, true, JSON.stringify(accepted));
        return { args, toolCallId, operationId: accepted.operationId };
      };
      const settled = async (turn, status = "completed") => {
        const state = await until(() => host.state(name), (value) => value.recentOperations.some((item) => item.operationId === turn.operationId), `${turn.args.operation} operation settles`);
        assert.equal(state.recentOperations.find((item) => item.operationId === turn.operationId).status, status);
        await until(() => host.state(name), (value) => value.state === "idle", "SDK returns to idle");
      };
      const finish = async (turn, expected) => {
        await settled(turn);
        const saved = host.history(name).snapshot.messages.find((message) => message.role === "toolResult" && message.toolCallId === turn.toolCallId);
        assert.equal(saved?.toolName, "remote_ui", "the real SDK persisted the target tool result");
        const message = host.toolContent(name, turn.toolCallId).result;
        assert.equal(message?.isError, false, JSON.stringify(message));
        const details = message.details;
        identity(details, turn);
        assert.equal(details.valueType, typeof expected);
        assert.equal(details.value, expected, "the browser/default answer came back from the target in the SDK tool result");
        results.push(details);
        return details;
      };
      const prompt = async (kind) => {
        const card = page.locator(`[data-prompt-kind="${kind}"]`);
        await card.waitFor({ state: "visible" });
        return card;
      };
      const transientDialog = async (kind, options) => {
        // Observe concurrently: awaiting the send click/HTTP receipt can outlive a short dialog.
        const observed = page.evaluate((kind) => new Promise((resolve, reject) => {
          const observer = new MutationObserver(check);
          const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Dialog ${kind} was never visible`)); }, 30000);
          function check() {
            const element = document.querySelector(`[data-prompt-kind="${kind}"]`);
            if (!element?.checkVisibility()) return;
            clearTimeout(timer);
            observer.disconnect();
            resolve(element.dataset.promptId);
          }
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });
          check();
        }), kind);
        void observed.catch(() => {});
        const turn = await begin(kind, options);
        const id = await observed;
        return { turn, id, card: page.locator(`[data-prompt-id="${id}"]`) };
      };
      const native = nativeAction(page, name);

      await checkRemoteDialogs({ begin, prompt, host, name, settled, until, targetResult, identity, results, page, upgradeUi: plugins.upgradeUi, sessionId, native, evidence, finish, transientDialog, events });
      const navigation = settingsNavigation(page);
      const management = await checkPluginManagement({ page, client, host, until, name, native, evidence, plugins, ...navigation });
      await checkRemoteCapabilityLayers({ page, host, packageSource: plugins.ui.source, until, name, native, ...navigation });

      const finalData = await begin("data");
      await finish(finalData);
      await page.locator('[data-widget-key="remote-ui-above"]').waitFor({ state: "visible" });
      await page.waitForFunction((text) => document.querySelector("#composer")?.value === text, `REMOTE_EDITOR:${finalData.args.token}`);
      await page.screenshot({ path: join(evidence, "remote-ui-complete.png"), fullPage: true, animations: "disabled" });
      assert.deepEqual(pageErrors, []);
      assert.deepEqual((await client.request("pluginsList", {})).packages.filter((pkg) => pkg.error || pkg.providerErrors.length), [], "Successful catalog discovery and its normal shutdown do not create plugin load errors");
      assert.ok(host.history(name).snapshot.messages.filter((message) => message.role === "toolResult").every((message) => message.toolName === "remote_ui"), "only real fixture tools ran; no synthetic edit/write events");
      await writeFile(join(evidence, "results.json"), JSON.stringify({ sessionId, url: ui.url, results, pageErrors, management: { ...management, capabilityLayers: ["global", "instance", "session"] }, scope: "Controlled faux provider; real linked plugin directories, session host, SDK, Gateway, HTTP, Vite and browser. Pi editor has no public dialog timeout/signal options; its abort is turn cancellation." }, null, 2));
      console.log(`PASS remote extension UI: target SDK results; browser notify/status/widgets/editor; four dialog answers/cancels; select/confirm/input timeout/abort; editor turn abort; ignored presentation warnings; stale response cannot answer replacement; linked directory repacked on reload; plugin list install/location/enable/uninstall proven after reload; plugin command executed on session host and Gateway. Evidence: ${evidence}`);
      console.log(`REMOTE_EXTENSION_UI_READY ${ui.url} sessionId=${sessionId} holdMs=${holdMs}`);
      await holdRemoteUi({ holdMs, signal, provider, fauxAssistantMessage, fauxToolCall });
    } catch (error) {
      await page?.screenshot({ path: join(evidence, "remote-ui-failure.png"), fullPage: true, animations: "disabled" }).catch(() => {});
      const state = inspectedWorker ? host.state(inspectedWorker) : undefined;
      await writeFile(join(evidence, "failure.json"), JSON.stringify({ error: error.stack, extensionUi: state?.extensionUi, operation: state?.operation, results }, null, 2));
      throw error;
    }
  }, { tempParent: root });
} finally {
  if (previousMarker === undefined) delete process.env.PRK_REMOTE_UI_MARKER;
  else process.env.PRK_REMOTE_UI_MARKER = previousMarker;
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
