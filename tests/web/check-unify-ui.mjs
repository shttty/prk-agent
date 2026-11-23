#!/usr/bin/env node
// Full-only real Web → HTTP → Gateway socket → SDK/Jupyter acceptance; only model responses are controlled.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { createToolControls } from "./unify-ui/create-tool-controls.mjs";
import { checkLocalSession } from "./unify-ui/check-local-session.mjs";
import { checkRemoteSession } from "./unify-ui/check-remote-session.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[name]) throw new Error(`${name} is required for unified session browser acceptance.`);
}
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/unified-session-ui");
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(tmpdir(), "prk-unify-ui-"));
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const nativeNames = ["bash", "edit", "find", "grep", "ls", "read", "write"];
async function until(read, description, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (!await read()) {
    assert.ok(Date.now() < deadline, `Timed out: ${description}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}
async function shot(page, name) {
  const path = join(evidence, `unify-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  assert.ok((await stat(path)).size > 0, `Screenshot was written: ${path}`);
}
function assertTools(tools, mode, localTools = false) {
  if (mode === "code") assert.deepEqual(tools, ["kernel_code", "kernel_interrupt", "kernel_read", ...(localTools ? nativeNames : [])].sort(), "Code adds only the selected native tools to the kernel tools");
  else {
    for (const name of ["kernel_code", "ask", "session_spawn", "session_send", "session_result"]) assert.ok(tools.includes(name), `${mode} declares ${name}`);
    for (const name of nativeNames) assert.equal(tools.includes(name), localTools, `${mode}: native ${name}`);
  }
  assert.equal(tools.includes("python"), false, "The execution tool is kernel_code in every mode");
}
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { createSessionHistory } = await import("../../src/sessions/history/assemble-history.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectWebGateway } = await import("../../src/http/gateway-connection/connect-gateway.ts");
  const { startWebServer } = await import("../../src/http/listener/start-listener.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  const { parseTargets } = await import("./target-instances/parse-targets.mjs");
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "unify-ui", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });
  runtime.registerNativeProvider(provider.provider);
  const declarations = [];
  provider.setResponses(Array.from({ length: 100 }, () => (context) => {
    const prompt = text([...context.messages].reverse().find((message) => message.role === "user"));
    declarations.push({ prompt, tools: getCurrentTools(context.messages).map(({ name }) => name).sort() });
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("UNIFY_UI_DONE");
    return fauxAssistantMessage(fauxToolCall("kernel_code", { code: prompt }), { stopReason: "toolUse" });
  }));
  await withTargetFixture(async ({ config, tempRoot, owned, onCleanup }) => {
    assert.equal(owned, true);
    assert.ok(tempRoot);
    const localCwd = join(tempRoot, "local");
    const remoteCwd = join(tempRoot, "remote");
    await mkdir(localCwd);
    await mkdir(remoteCwd);
    // Remote deliberately comes first and reaches the same machine (its connection command `sh` is a POSIX shell, D0):
    // locality must be explicit, not inferred.
    const targets = parseTargets([
      { id: "remote", label: "Remote fixture", tags: [], ...config, local: false, sshCommand: "sh", cwd: remoteCwd },
      { id: "local-first", label: "Local first", tags: [], ...config, cwd: localCwd },
      { id: "local-second", label: "Local second", tags: [], ...config, cwd: localCwd },
    ]);
    let browser;
    onCleanup(async () => { await browser?.close(); });
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    for (const [device, viewport] of [
      ["desktop", { width: 1440, height: 900 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      const label = `${device}-light`;
      const scheme = "light";
      const dir = join(root, label);
      await mkdir(dir, { mode: 0o700 });
      let host, gateway, client, web, ui, context, closing;
      const close = () => closing ??= (async () => {
        const results = await Promise.allSettled([context?.close(), ui?.close(), web?.close(), client?.close()]);
        results.push(...await Promise.allSettled([gateway ? gateway.close() : host?.close()]));
        const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason);
        if (failures.length) throw new AggregateError(failures, `${label}: owned stack cleanup failed`);
      })();
      onCleanup(close);
      try {
        // Seed an unknown tool through the real native history seam, not browser mocks.
                const history = await createSessionHistory({ cwd: dir, directory: join(dir, "history") });
        const unknown = history.create("local-first", "Unknown tool", "python3", localCwd);
        const unknownName = unknown.getSessionId();
        const unknownCall = fauxToolCall("unknown_fixture_tool", { value: "UNKNOWN_INPUT" });
        unknown.appendMessage(fauxAssistantMessage(unknownCall, { stopReason: "toolUse" }));
        unknown.appendMessage({ role: "toolResult", toolCallId: unknownCall.id, toolName: "unknown_fixture_tool", content: [{ type: "text", text: "UNKNOWN_TOOL_RESULT" }], isError: false, timestamp: Date.now() });
        unknown.appendMessage(fauxAssistantMessage("UNKNOWN_REPLY"));
        host = await createGatewayHost({
          cwd: dir, home: root, historyDir: join(dir, "history"), targets, model: "unify-ui/controlled",
          config: parsePrkConfig({ monitor: { enabled: false }, session: { workerTools: "code", idleTimeoutMs: 60_000 } }),
        }, { runtimeDependencies: { cwd: dir, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
        const socket = join(dir, "g.sock");
        gateway = await startGateway(host, socket);
        client = await connectWebGateway({ socket });
        web = await startWebServer(client, { host: "127.0.0.1", port: 0 });
        ui = await startWebDev(web.url);
        const phone = viewport.width === 390;
        context = await browser.newContext({ viewport, colorScheme: scheme, isMobile: phone, hasTouch: phone });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const problems = [];
        page.on("pageerror", (error) => problems.push(error.message));
        const click = async (locator) => { if (phone) await locator.tap(); else await locator.click(); };
        const sidebar = async () => {
          const toggle = page.locator("#open-sidebar");
          if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") !== "true") await click(toggle);
        };
        const dialog = page.locator('#management-dialog[data-kind="create"]');
        const options = () => page.locator('[role="option"]:visible');
        const targetOption = (name) => page.locator(`[role="option"][value=${JSON.stringify(name)}]:visible`);
        async function selectedTarget(expected) {
          await click(dialog.locator("#create-session-target"));
          assert.deepEqual(await options().evaluateAll((nodes) => nodes.map((node) => node.getAttribute("value"))), ["local-first", "local-second", "remote"], "All instances, stable local-first order");
          assert.equal(await targetOption(expected).getAttribute("aria-selected"), "true", "Instance preselection");
          await page.locator("#create-session-target").press("Escape");
        }
        async function create(expectedTarget, expectedCwd) {
          await until(async () => await dialog.locator("#create-session-cwd").inputValue() === expectedCwd && await dialog.locator("#confirm-create-session").isEnabled(), "selected instance environment loads");
          const response = page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === "/api/sessions");
          await click(dialog.locator("#confirm-create-session"));
          const created = await response;
          assert.equal(created.status(), 201);
          assert.deepEqual(created.request().postDataJSON(), { target: expectedTarget, cwd: expectedCwd });
          const { session: worker } = await created.json();
          assert.equal(worker.target, expectedTarget);
          assert.equal(worker.cwd, expectedCwd);
          await dialog.waitFor({ state: "hidden" });
          await until(async () => await page.locator("#chat-tool-mode").isEnabled(), "live session tool-mode becomes available");
          return worker;
        }
        const { selectedMode, changeMode, changeLocalTools, reloadTools } = createToolControls({ page, client, host, click, until, phone });
        async function checkMetaLayout() {
          // Under the composer: model, thinking, tool mode, context. Send mode and local tools are session settings now.
          const ids = ["chat-model-select", "chat-thinking-select", "chat-tool-mode", "context-usage"];
          assert.equal(await page.locator("#composer-meta").locator("#queue-select, #chat-local-tools, #chat-delegation-select").count(), 0, "session settings are not under the composer");
          const bounds = await page.evaluate((ids) => ids.map((id) => {
            const node = document.getElementById(id);
            const { x, y, width, height } = node.getBoundingClientRect();
            return { id, x, y, width, height };
          }), ids);
          for (const box of bounds) assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${box.id} stays visible`);
          for (let i = 0; i < bounds.length; i++) for (const other of bounds.slice(i + 1)) {
            const box = bounds[i];
            assert.ok(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y, `${box.id} does not overlap ${other.id}`);
          }
        }
        // Each real state is rendered in both schemes before the next functional transition.
        async function themes(inspect) {
          for (const scheme of ["light", "dark"]) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.locator(`html[data-mantine-color-scheme="${scheme}"]`).waitFor();
            await inspect(`${device}-${scheme}`, scheme);
          }
          await page.emulateMedia({ colorScheme: "light" });
          await page.locator('html[data-mantine-color-scheme="light"]').waitFor();
        }
        async function send(worker, code) {
          await page.locator("#composer").fill(code);
          const response = page.waitForResponse((candidate) => candidate.request().method() === "POST"
            && new URL(candidate.url()).pathname === `/api/sessions/${worker.sessionId}/send`);
          await click(page.locator("#send-message"));
          assert.equal((await (await response).json()).accepted, true);
        }
        async function completed(worker, marker, from) {
          await until(() => host.state(worker.sessionId).state === "idle" && declarations.slice(from).filter((entry) => entry.prompt.includes(marker)).length >= 2, "SDK tool turn completes");
          const result = host.state(worker.sessionId).messages.findLast((message) => message.role === "toolResult");
          assert.equal(result.toolName, "kernel_code");
          assert.equal(result.isError, false, text(result));
          assert.ok(text(result).includes(marker), "Real Jupyter execution returns the test marker");
          await page.locator(`[data-tool-name="kernel_code"][data-tool-key$=${JSON.stringify(`:${result.toolCallId}`)}][data-state="done"]`).waitFor({ state: "attached" });
          return declarations.slice(from).filter((entry) => entry.prompt.includes(marker));
        }
        await checkLocalSession({ page, ui, host, unknownName, click, selectedTarget, dialog, themes, shot, create, localCwd, changeMode, changeLocalTools, reloadTools, label, declarations, send, completed, assertTools, checkMetaLayout, selectedMode, phone, until });

        await checkRemoteSession({ page, client, host, click, sidebar, selectedTarget, dialog, targetOption, create, remoteCwd, selectedMode, themes, shot, changeMode, label, declarations, send, completed, assertTools, unknownName, viewport, problems, phone });

      } finally { await close(); }
    }
  });
  console.log(`PASS unified session browser acceptance; controlled provider only; screenshots: ${evidence}`);
} finally { await rm(root, { recursive: true, force: true }); }
