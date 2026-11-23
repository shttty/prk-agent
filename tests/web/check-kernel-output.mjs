// Real SDK/Gateway/Jupyter/Vite/Chromium; faux provider only, no UI-copy assertions.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";

for (const name of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required`);
const root = await mkdtemp(join(tmpdir(), "prk-kernel-output-"));
const text = (message) => (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const outputBytes = 6000, maxOutputChars = 12000;
try {
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const { agentDir } = initializePrkHome(root);
    await mkdir(agentDir, { recursive: true });
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
    const { startWebApplication } = await import("../../src/http/application/start-application.ts");
    const { startWebDev } = await import("../fixtures/web-dev.mjs");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "kernel-output-check", models: [{ id: "controlled" }], tokensPerSecond: 100_000 });
    runtime.registerNativeProvider(provider.provider);
    const consumed = new Map();
    provider.setResponses(Array.from({ length: 30 }, () => (context) => {
      const last = context.messages.at(-1);
      if (last?.role === "toolResult") {
        consumed.set(last.toolCallId, last);
        return fauxAssistantMessage("Observed kernel output.");
      }
      const request = /^KERNEL_OUTPUT_FIXTURE (\{.*\})$/s.exec(text(last));
      assert(request);
      const { id, code } = JSON.parse(request[1]);
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code, title: id }, { id }), { stopReason: "toolUse" });
    }));
    let host, gateway, client, web, ui, browser;
    onCleanup(async () => { await browser?.close(); await ui?.close(); await web?.close(); client?.disconnect(); if (gateway) await gateway.close(); else await host?.close(); });
    host = await createGatewayHost({
      cwd: root, home: root, model: "kernel-output-check/controlled",
      config: parsePrkConfig({ session: { workerTools: "code", idleTimeoutMs: 60_000 }, memory: { review: false }, kernel: { maxOutputChars }, terminal: { outputBytes, longLineThresholdChars: 500, longLineHeadChars: 24, longLineTailChars: 24 } }),
      targets: parseTargets([{ id: "fixture", label: "Fixture", ...config, cwd: tempRoot }]),
    }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
    const socket = join(root, "gateway.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const name = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    async function run(id, code, isError = false) {
      const operation = await host.session(name).submit({ requestId: id, message: `KERNEL_OUTPUT_FIXTURE ${JSON.stringify({ id, code })}` });
      assert.equal(operation.accepted, true, operation.error);
      assert.equal((await operation.completion).status, "completed");
      const result = consumed.get(id);
      assert(result, "provider consumes the real SDK result");
      assert.equal(result.isError, isError, text(result));
      return result;
    }
    const plain = await run("plain-output", "print('PLAIN_OUTPUT')");
    assert.equal(text(plain).split("\n")[0], "PLAIN_OUTPUT");
    assert(!Object.hasOwn(plain.details, "rawOutput"), "identical output must not be duplicated");
    const formatted = await run("formatted-output", String.raw`
print('\x1b[31mCOLORED_OUTPUT\x1b[0m')
print('progress-old\rprogress-middle\rprogress-final')
print('repeat-row\n' * 8, end='')
print('\n\n\nblank-tail')
print('LONG_HEAD' + 'x' * 2000 + 'LONG_TAIL')
formatted_variable = 7
`);
    const compact = text(formatted);
    assert.doesNotMatch(compact, /\x1b|\r/);
    assert(compact.includes("COLORED_OUTPUT\nprogress-final\nrepeat-row ×8\n\nblank-tail\n"));
    assert(!compact.includes("progress-old") && !compact.includes("progress-middle"));
    assert(!compact.split("\n\nKernel variables")[0].includes("\n\n\n"), "cell blank lines collapse; the existing metadata separator is unchanged");
    assert.match(compact, /LONG_HEADx+ …\[\+\d+ chars\]… x+LONG_TAIL/);
    assert(formatted.details.namespace.added.some((entry) => entry.name === "formatted_variable"));
    assert(compact.includes('"formatted_variable"'));
    assert.match(compact.trimEnd().split("\n").at(-1), /^\[kernel memory /);
    assert.equal(formatted.details.truncated, true, "long-line shortening is reported");
    assert(formatted.details.rawOutput.includes("\x1b[31mCOLORED_OUTPUT\x1b[0m\nprogress-old\r"));
    assert(formatted.details.rawOutput.includes("repeat-row\n".repeat(8)));
    const oversized = await run("unicode-output", "print('UNICODE_HEAD' + '中😀' * 10000 + 'UNICODE_TAIL')");
    const unicodeCell = text(oversized).split("\n[kernel memory")[0];
    const omitted = [...unicodeCell.matchAll(/…\[\+(\d+) chars\]…/gu)].reduce((sum, match) => sum + Number(match[1]), 0);
    const retained = unicodeCell.replace(/\n? …\[\+\d+ chars\]… \n?/gu, "");
    assert.equal(retained.length + omitted, (`UNICODE_HEAD${"中😀".repeat(10000)}UNICODE_TAIL\n`).length, "capture and long-line omissions account for the original UTF-16 length");
    assert(unicodeCell.startsWith("UNICODE_HEAD") && unicodeCell.endsWith("UNICODE_TAIL\n"));
    assert.doesNotMatch(unicodeCell, /\uFFFD|offset=|terminal_read/);
    const failed = await run("traceback-output", String.raw`
print('TRACE_HEAD_SENTINEL')
for n in range(3000):
    print(f'noise-{n:04d}: ' + 'z' * 40)
    if n % 500 == 0:
        __import__('sys').stdout.flush()
def trace_inner():
    raise ValueError('TRACE_TAIL_SENTINEL')
def trace_outer():
    trace_inner()
trace_outer()
`, true);
    const model = text(failed);
    assert.doesNotMatch(model, /\x1b|\r|terminal_read\(|offset=/);
    assert(model.startsWith("TRACE_HEAD_SENTINEL\n"));
    assert.match(model, /…\[\+\d+ chars\]…/);
    assert(!model.includes("noise-1500:"), "middle noise is removed");
    for (const part of ["trace_outer", "trace_inner", "raise ValueError", "ValueError: TRACE_TAIL_SENTINEL"]) assert(model.includes(part), part);
    const cellText = model.split("\n\nKernel variables")[0].split("\n[target ")[0];
    assert(Buffer.byteLength(cellText) <= outputBytes, "model cell output uses terminal.outputBytes");
    assert.equal(failed.details.truncated, true);
    assert(failed.details.rawOutput.includes("\x1b["), "raw traceback preserves ANSI");
    assert(failed.details.rawOutput.includes("TRACE_TAIL_SENTINEL"));
    assert(failed.details.rawOutput.length <= maxOutputChars + outputBytes, "raw output is bounded, including marker and metadata");
    const snapshot = await client.request("state", { sessionId: name });
    const projected = snapshot.messages.find((entry) => entry.toolCallId === "traceback-output");
    assert(projected.outputPreview, "large raw details follow existing lazy delivery");
    assert.equal(projected.outputPreview.bytes, Buffer.byteLength(failed.details.rawOutput));
    const full = await client.request("toolContent", { sessionId: name, toolCallId: "traceback-output" });
    assert.equal(full.result.details.rawOutput, failed.details.rawOutput);
    assert.equal(text(full.result), model, "raw display data never replaces model content");

    web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const verify = async () => {
      await page.goto(ui.url);
      await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
      await page.locator('.pi-tool[data-tool-key$=":traceback-output"]').waitFor({ state: "attached" });
      const row = page.locator('.pi-tool[data-tool-key$=":traceback-output"]');
      const turn = row.locator('xpath=ancestor::details[contains(@class,"pi-turn-process")]');
      if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
      if (!await row.evaluate((node) => node.open)) await row.locator(":scope > summary").click();
      await row.locator('[data-action="expand-lines"][data-total-bytes]').first().click();
      await page.locator('.pi-tool[data-tool-key$=":traceback-output"][data-content-state="loaded"]').waitFor();
      await row.locator('.output-block .pi-ansi').first().waitFor({ state: "visible" });
      assert.equal(await row.evaluate((node) => node.open), true, "the tested tool body is actually expanded");
      const shown = await row.locator('.output-block').textContent();
      assert.equal(shown, stripVTControlCharacters(failed.details.rawOutput));
      assert(shown.includes("TRACE_TAIL_SENTINEL"));
      assert.equal(await row.getAttribute("data-state"), "error");
      const tones = await row.locator('.pi-ansi[data-ansi-tone]').evaluateAll((nodes) => nodes.map((node) => node.dataset.ansiTone));
      assert(tones.includes("danger"), "traceback keeps semantic ANSI color");
      return row;
    };
    const row = await verify(); // load authoritative SDK history after execution; this is not a live-update check
    if (process.env.PI_TEST_WEB_EVIDENCE) {
      await mkdir(process.env.PI_TEST_WEB_EVIDENCE, { recursive: true });
      await row.locator(".output-block .pi-cl").last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, "kernel-traceback.png") });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ fixture: "real SDK/Gateway/target daemon/Vite/Chromium", ansiModel: false, ansiWeb: true, tracebackTail: "complete", progress: "last state", repeatCount: 8, modelBytes: Buffer.byteLength(cellText), rawChars: failed.details.rawOutput.length, paidCalls: 0 }));
  });
} finally { await rm(root, { recursive: true, force: true }); }
