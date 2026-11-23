// One focused real SDK/Gateway/Jupyter/faux scenario; no device matrix or related full suites.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-outcomes-"));
async function until(predicate, description) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) { const result = await predicate(); if (result) return result; await new Promise((resolve) => setTimeout(resolve, 25)); }
  throw new Error(`Timed out: ${description}`);
}
const exists = async (path) => { try { await readFile(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } };
let host, gateway, client, web, ui, browser;
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
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
    const provider = fauxProvider({ provider: "outcome-fixture", models: [{ id: "controlled" }], tokensPerSecond: 4000 });
    runtime.registerNativeProvider(provider.provider);
    const socket = join(root, "gateway.sock");
    host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), targets: parseTargets([{ id: "fixture", label: "Fixture", ...config, cwd: root }]), model: "outcome-fixture/controlled", config: parsePrkConfig({ session: { workerTools: "code" } }) }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const { session: { sessionId: worker } } = await client.request("createSession", { target: "fixture" });
    const state = () => client.request("state", { sessionId: worker });
    const terminal = (id) => until(async () => (await state()).recentOperations.find((item) => item.operationId === id), "completion");
    web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    await page.goto(ui.url);
    await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
    const send = async (message) => {
      await page.locator("#composer").fill(message);
      const response = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/send"));
      await page.locator("#send-message").click();
      return (await (await response).json()).operationId;
    };
    const step = (code) => fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" });

    const marker = join(root, "cell-started");
    provider.setResponses([step(`import time\nfrom pathlib import Path\nPath(${JSON.stringify(marker)}).write_text('started')\ntime.sleep(30)`)]);
    const cell = await send("CELL_STOP");
    await until(() => exists(marker), "cell executing before stop");
    await page.locator("#cancel-operation").click();
    const stopped = await terminal(cell);
    assert.deepEqual([stopped.status, stopped.error], ["cancelled", undefined], "cell stop is cancelled without abort error");
    await page.locator('.pi-operation-outcome[data-status="cancelled"]').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ outcomes: [...document.querySelectorAll(".pi-operation-outcome")].map((node) => [node.dataset.status, node.classList.contains("is-error")]), banners: document.querySelectorAll("#connection-banner").length, recovery: document.querySelectorAll("#recovery-controls").length })), { outcomes: [["cancelled", false]], banners: 0, recovery: 0 }, "stop has one ordinary outcome and no banner/recovery strip");
    await page.reload();
    await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
    await page.locator(".pi-turn-process").waitFor();
    assert.deepEqual(await page.evaluate(() => ({ group: document.querySelector(".pi-turn-process")?.dataset.state, badge: document.querySelector('.pi-tool[data-tool-name="kernel_code"] .tool-status')?.dataset.state })), { group: "interrupted", badge: "interrupted" }, "after reload the stopped cell group and tool still show interrupted");

    let streamed = false;
    client.onEvent((event, name) => { if (name === worker && event.type === "message" && event.text) streamed = true; });
    await client.request("subscribe", { sessionId: worker });
    provider.setResponses([fauxAssistantMessage("streaming ".repeat(30_000))]);
    const stream = await send("STREAM_STOP");
    await until(() => streamed, "model text delta before stop");
    await page.locator("#cancel-operation").click();
    const streamStopped = await terminal(stream);
    assert.deepEqual([streamStopped.status, streamStopped.error], ["cancelled", undefined], "stream stop is cancelled without abort error");

    provider.setResponses([step("print('\\x1b[32mTraceback\\n  \\x1b[1mfixture error\\x1b[22m\\x1b[39m\\n\\x1b[36mValueError: fixture\\x1b[0m\\x1b[2K\\x1b]0;ignored-title\\x07')"), fauxAssistantMessage("ANSI_DONE")]);
    await terminal(await send("ANSI_OUTPUT"));
    const result = (await state()).messages.findLast((message) => message.role === "toolResult");
    const tool = page.locator(`.pi-tool[data-tool-key$=":${result.toolCallId}"]`);
    await tool.waitFor({ state: "attached" });
    await tool.evaluate((node) => { for (let current = node; current; current = current.parentElement) if (current.tagName === "DETAILS") current.open = true; });
    const output = tool.locator(".output-block");
    await output.waitFor();
    // The trailing `[kernel memory …]` line is the code-mode result footer, not tool stdout.
    assert.deepEqual(await output.evaluate((node) => ({ text: node.textContent.replace(/\n\[kernel memory [^\]]*\]$/, ""), bold: node.querySelector('[data-ansi-tone="success"][data-ansi-style~="bold"]')?.textContent, accent: node.querySelector('[data-ansi-tone="accent"]')?.textContent })), { text: "Traceback\n  fixture error\nValueError: fixture\n", bold: "fixture error", accent: "ValueError: fixture" }, "ANSI renders styles and only plain source text");

    provider.setResponses([step("import os\nos.kill(os.getpid(), 9)"), fauxAssistantMessage("KERNEL_LOST")]);
    assert.equal((await terminal(await send("KERNEL_LOSS"))).status, "unknown", "non-user kernel death remains unknown");
  });
} finally { await rm(root, { recursive: true, force: true }); }
console.log("PASS focused outcomes: cell/stream stop cancelled, non-user unknown; one stop outcome and ANSI rendering");
