import { stringify } from "smol-toml";
// Distinct workers/contexts; only the real Gateway/API/Vite/browser stack is shared.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { TOOL_FOLD_LINES } from "../../web/chat/tool-text/tool-text-constants.js";
import { nestedSummary } from "../../web/chat/tool-text/nested-summary.js";
import { parseDiff } from "../../web/chat/tool-text/parse-diff.js";
import { splitReadNotice } from "../../web/chat/tool-text/split-read-notice.js";
import { selectSession } from "./workspace-mock/select-session.mjs";
import { checkArtifactBrowser } from "./tool-content/check-artifact-browser.mjs";
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

export async function installToolBodyFixture(agentDir) {
  await writeFile(join(agentDir, "extensions/nested-probe.js"), `
import { Text } from ${JSON.stringify(import.meta.resolve("@earendil-works/pi-tui"))};
export default function(pi) {
  const base = (name, extra) => ({ name, label: name, description: name, parameters: { type: "object", properties: {} }, ...extra });
  const text = (value) => ({ content: [{ type: "text", text: value }] });
  pi.registerTool(base("probe_inner", { async execute() { return text("inner ok"); } }));
  pi.registerTool(base("probe_fail", { async execute() { throw new Error("inner failed"); } }));
  const outer = async (_id, _params, _signal, _update, ctx) => {
    await ctx.executeTool("probe_inner", {});
    await ctx.executeTool("probe_fail", {});
    await ctx.executeTool("probe_inner", {});
    return text("outer done");
  };
  pi.registerTool(base("probe_outer", { execute: outer }));
  pi.registerTool(base("probe_outer_ui", { execute: outer, renderCall() { return new Text("outer_ui call", 0, 0); }, renderResult() { return new Text("outer_ui result", 0, 0); } }));
}`);
}

export async function prepareArtifactFixture(home, prkConfig) {
    const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
    assert(arch, "This check requires a supported Linux architecture");
    const scripts = ["#!/bin/sh\nprintf artifact-one\n", "#!/bin/sh\nprintf artifact-two\n"];
    const hashes = scripts.map(sha);
    const imported = "#!/bin/sh\nprintf legacy-artifact\n";
    const old = join(home, "assets/bin/legacyprobe", `linux-${arch}`, "legacyprobe");
    await mkdir(dirname(old), { recursive: true });
    await writeFile(old, imported);
    const importedRun = await promisify(execFile)(process.execPath, ["scripts/import-tool-artifacts.mjs", "--home", home], { cwd: resolve(".") });
    console.log(importedRun.stdout.trim());
    assert.equal(await readFile(old, "utf8"), imported, "Import preserves original bytes");
    await writeFile(join(home, "config.toml"), stringify({ artifacts: prkConfig.artifacts }));
  return { arch, scripts, hashes, imported };
}

export async function realToolBodies({ host, client, ui, browser, provider }) {
  const worker = await client.request("createSession", { target: "fixture" });
  const name = worker.session.sessionId;
  const lines = (count, make) => Array.from({ length: count }, (_, i) => make(i));
  const settings = ["/** Settings. */", "export interface Settings {", "  name: string;", "}", ...lines(26, (i) => `export const N${i} = ${i};`)].join("\n");
  const yamlOld = lines(70, (i) => (i === 3 ? "shape: box" : i === 35 ? "preset: default" : i === 66 ? "tail: web/dist" : `key_${i}: value_${i}`)).join("\n");
  const edits = [["shape: box", "shape: box\ntokenRate: true"], ["preset: default", "preset: nerd"], ["tail: web/dist", "tail: web/dist\nassets: true"]].map(([oldText, newText]) => ({ oldText, newText }));
  const bashCommand = "seq 1 45";
  const step = (toolName, args) => fauxAssistantMessage(fauxToolCall(toolName, args), { stopReason: "toolUse" });
  provider.setResponses([
    step("write", { path: "settings.ts", content: settings }),
    step("write", { path: "config.yml", content: yamlOld }),
    step("edit", { path: "config.yml", edits }),
    step("edit", { path: "config.yml", edits: [{ oldText: "no such text", newText: "x" }] }),
    step("read", { path: "settings.ts", offset: 2, limit: 25 }),
    step("bash", { command: bashCommand, timeout: 30 }),
    step("bash", { command: "echo plain" }),
    step("probe_outer", {}),
    step("probe_outer_ui", {}),
    fauxAssistantMessage("done"),
  ]);

  const select = async (page) => { if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click(); await selectSession(page, name); };
  const openRows = async (page) => {
    const turn = page.locator("details.pi-turn-process").first();
    await turn.waitFor();
    if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
    for (const summary of await page.locator(".pi-tool > summary").all()) { await summary.click(); await page.waitForTimeout(80); }
    await page.mouse.move(0, 0);
  };
  const tool = (page, id) => page.locator(`.pi-tool[data-tool-key$=":${id}"]`);
  const fold = (locator) => locator.locator('[data-action="expand-lines"]').first();
  const hiddenOf = async (locator) => Number(await fold(locator).getAttribute("data-hidden-lines"));

  const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
  await page.goto(ui.url);
  await select(page);
  const admitted = await host.session(name).submit({ requestId: "tool-bodies-1", message: "run the tool bodies" });
  assert(admitted.accepted);
  assert.equal((await admitted.completion).status, "completed");
  await page.locator('.topbar-status[data-status="idle"]').waitFor();

  const snapshot = host.state(name);
  const results = await Promise.all(snapshot.messages.filter((message) => message.role === "toolResult").map(async (message) => message.outputPreview
    ? (await client.request("toolContent", { sessionId: name, toolCallId: message.toolCallId })).result
    : message));
  assert.deepEqual(results.map((result) => result.toolName), ["write", "write", "edit", "edit", "read", "bash", "bash", "probe_outer", "probe_outer_ui"]);
  const [writeSettings, , editOk, editFail, readResult, bashTimeout, bashPlain, outer, outerUi] = results;
  const textOf = (message) => message.content.map((part) => part.text).join("");
  assert.equal(editFail.isError, true);

  // What the DOM must show, derived from the Pi results themselves.
  const nestedExpected = [{ name: "probe_inner", count: 2, failed: false }, { name: "probe_fail", count: 1, failed: true }];
  assert.deepEqual(nestedSummary(outer), nestedExpected, "the SDK's nestedCalls record has the shape the summary reads");
  assert.deepEqual(nestedSummary(outerUi), nestedExpected);
  const diffExpected = parseDiff(editOk.details.diff);
  assert(diffExpected.rows.length > TOOL_FOLD_LINES && diffExpected.add > 0 && diffExpected.del > 0);
  const readSplit = splitReadNotice(textOf(readResult));
  assert(readSplit.notice, `Pi's read result carries a continuation notice: ${JSON.stringify(textOf(readResult).slice(-80))}`);
  // Deferred wire previews count newline-delimited lines, including the final empty line.
  const bashRows = textOf(bashTimeout).split("\n").length;
  assert(bashRows > TOOL_FOLD_LINES);

  // One signature of everything the DOM shows per row, compared live vs after a reload.
  // Calls a tool made itself (id `<parent>/<n>`) must not render as rows at all (nested live events are dropped).
  const signature = (target) => target.locator("body").evaluate((root) => [...root.querySelectorAll(".pi-tool")].map((row) => {
    const diffstat = row.querySelector(".pi-tool-diffstat");
    return {
      id: row.dataset.toolKey.split(":").at(-1),
      state: row.dataset.state,
      kind: row.querySelector(".pi-io")?.dataset.kind ?? "plugin",
      header: row.querySelector("summary .pi-tool-args")?.textContent ?? "",
      diffstat: diffstat ? { add: Number(diffstat.dataset.add), del: Number(diffstat.dataset.del) } : null,
      folds: [...row.querySelectorAll('[data-action="expand-lines"]')].map((button) => button.dataset.hiddenLines),
      notes: [...row.querySelectorAll(".pi-io-note")].map((note) => ({ kind: note.dataset.kind, ...(note.dataset.kind === "meta" ? { timeoutSeconds: Number(note.dataset.timeoutSeconds) } : { text: note.textContent }) })),
      nested: [...row.querySelectorAll(".pi-nested-call")].map((node) => `${node.dataset.name}|${node.dataset.count}|${node.dataset.status}`),
    };
  }));

  const verify = async (target) => {
    const write = tool(target, writeSettings.toolCallId);
    await write.locator(".code-block .tok-keyword").first().waitFor({ state: "attached" });
    assert.equal(await write.locator(".pi-io-note").textContent(), textOf(writeSettings).trim(), "write shows the result text Pi returned");
    assert.equal(await write.locator(".output-block, .pi-io-rule").count(), 0);
    assert.equal(await write.locator(".code-block .tok-comment").count() > 0, true, "comment tokens exist for the .ts file");
    assert.equal(await hiddenOf(write), settings.split("\n").length - TOOL_FOLD_LINES);
    // edit
    const edit = tool(target, editOk.toolCallId);
    const stat = edit.locator(".pi-tool-diffstat");
    assert.deepEqual([Number(await stat.getAttribute("data-add")), Number(await stat.getAttribute("data-del"))], [diffExpected.add, diffExpected.del]);
    await fold(edit).click();
    assert.equal(await edit.locator(".pi-cl-diff .is-add").count(), diffExpected.add);
    assert.equal(await edit.locator(".pi-cl-diff .is-del").count(), diffExpected.del);
    const failed = tool(target, editFail.toolCallId);
    assert.equal(await failed.getAttribute("data-state"), "error");
    assert.equal(await failed.locator(".pi-cl-diff, .pi-tool-diffstat").count(), 0, "a failed edit has no diff");
    assert.equal(await failed.locator(".output-block").textContent(), textOf(editFail));
    // read
    const read = tool(target, readResult.toolCallId);
    await read.locator(".output-block .tok-keyword").first().waitFor({ state: "attached" });
    assert.equal(await read.locator('.pi-io-note[data-kind="read-notice"]').textContent(), readSplit.notice);
    await fold(read).click();
    assert.equal(await read.locator(".output-block").textContent(), readSplit.body, "code block holds only the file text");
    assert.equal(await read.locator("summary .pi-tool-args").textContent(), "settings.ts:2");
    // bash
    const timed = tool(target, bashTimeout.toolCallId);
    assert.equal(await timed.locator(".pi-cl-prompt").textContent(), bashCommand);
    assert.equal(await timed.locator("summary .pi-tool-args").count(), 0);
    const timeoutNote = timed.locator('.pi-io-note[data-kind="meta"]');
    assert.equal(await timeoutNote.count(), 1, "timeout argument: one meta line");
    assert.equal(Number(await timeoutNote.getAttribute("data-timeout-seconds")), 30);
    assert.equal(await hiddenOf(timed), bashRows - TOOL_FOLD_LINES);
    assert.equal(await tool(target, bashPlain.toolCallId).locator('.pi-io-note[data-kind="meta"]').count(), 0);
    // nested summary: same entries for the plain parent and the plugin parent
    for (const [message, plugin] of [[outer, false], [outerUi, true]]) {
      const row = tool(target, message.toolCallId);
      assert.deepEqual(await row.locator(".pi-nested-call").evaluateAll((nodes) => nodes.map((node) => ({ name: node.dataset.name, count: Number(node.dataset.count), failed: node.dataset.status === "error" }))), nestedExpected);
      assert.equal(await row.locator(plugin ? ".pi-tool-body > .pi-nested-calls" : ".pi-io > .pi-nested-calls").count(), 1);
    }
  };

  // The expanded folds above are local view state; compare rows before touching them.
  await openRows(page);
  const live = await signature(page);
  await verify(page);
  const refreshed = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
  await refreshed.goto(ui.url);
  await select(refreshed);
  await openRows(refreshed);
  assert.deepEqual(await signature(refreshed), live, "after a reload every row shows what it showed live, nested summaries included");
  await verify(refreshed);
  console.log("PASS real path: write/edit/read/bash bodies from Pi's own results, nested-call summary from the SDK record, live == reloaded");
  await page.close();
  await refreshed.close();
}

export async function toolArtifacts({ home, host, client, web, ui, browser, provider, arch, scripts, hashes, imported }) {
  if (evidence) await mkdir(evidence, { recursive: true });
    provider.setResponses(Array.from({ length: 80 }, () => (context) => {
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Observed target bytes.");
      const message = [...context.messages].reverse().find((entry) => entry.role === "user");
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code: text(message) }), { stopReason: "toolUse" });
    }));
    const worker = (await host.createSession({ target: "fixture", label: "Artifact proof" })).session.sessionId;
    // Preserve the artifact suite's code-mode/non-native worker without changing the other cohorts.
    for (const [action, args] of [["tool-mode", { mode: "code" }], ["local-tools", { enabled: false }], ["reload", {}]]) {
      const changed = await client.request("nativeAction", { sessionId: worker, requestId: `artifact-${action}`, action, args });
      if (changed.status !== "completed") throw new Error(JSON.stringify(changed));
    }
    await checkArtifactBrowser({ browser, ui, host, sessionId: worker, arch, scripts, hashes, imported, home, web, evidence, sha, text });
}
