// Tool-row bodies in the browser, driven by synthetic history (page.route + a fake EventSource over the real web/ Vite
// dev server): every built-in body kind, folding, read/write notes, nested-call summary, plugin rows, and the boundary
// cases the real path cannot produce on demand (old history without `diff`, half-streamed arguments, unknown language,
// empty output, very long lines). Real Pi result texts and live nested calls: check-tool-bodies-real.mjs.
import { checkContrast } from "./tool-bodies/check-contrast.mjs";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { TOOL_FOLD_LINES } from "../../web/chat/tool-text/tool-text-constants.js";
import { nestedSummary } from "../../web/chat/tool-text/nested-summary.js";
import { parseDiff } from "../../web/chat/tool-text/parse-diff.js";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { closeSessionDetails, openSessionDetails } from "../fixtures/session-details.mjs";

for (const name of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required for browser tests`);
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });

const now = Date.now();
const lines = (count, make) => Array.from({ length: count }, (_, i) => make(i));
const pyCode = ["import json", "# 按地区汇总", "class Stats:", "    def total(self) -> float:", "        return 1.5 if True else None", ...lines(24, (i) => `x${i} = ${i}`)].join("\n");
const pyOut = lines(30, (i) => `row ${i}`).join("\n");
const tsSource = ["import { readFile } from \"node:fs/promises\";", "", "/** Load settings. */", "export async function load(path: string): Promise<string> {", "  return readFile(path, \"utf8\");", "}", ...lines(26, (i) => `export const N${i} = ${i};`)].join("\n");
const yamlOld = lines(70, (i) => (i === 3 ? "shape: box" : i === 35 ? "preset: default" : i === 66 ? "tail: web/dist" : `key_${i}: value_${i}`)).join("\n");
const yamlNew = yamlOld.replace("shape: box", "shape: box\ntokenRate: true").replace("preset: default", "preset: nerd").replace("tail: web/dist", "tail: web/dist\nassets: true");
const { generateDiffString } = await import(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/core/tools/edit-diff.js", import.meta.url).href);
const diff = generateDiffString(yamlOld, yamlNew);
const diffExpect = parseDiff(diff.diff);
assert(diffExpect.rows.length > TOOL_FOLD_LINES, "fixture diff is long enough to fold");
const longLine = `https://example.invalid/${"segment".repeat(120)}`;
const nestedCalls = { complete: true, calls: [
  { id: "k1/1", name: "web_search", status: "ok" }, { id: "k1/2", name: "fetch_content", status: "ok" },
  { id: "k1/3", name: "todo_list", status: "ok" }, { id: "k1/4", name: "web_search", status: "error", error: "rate limited" },
] };
const nodeText = (...text) => ({ kind: "text", lines: text });

// [toolName, id, arguments, result text, isError, details, nestedCalls]
const calls = [
  ["kernel_code", "k1", { code: pyCode }, pyOut, false, undefined, nestedCalls],
  ["bash", "b1", { command: "grep -rn TODO . | head -n 30", timeout: 300 }, lines(30, (i) => `./f${i}.py:${i}: # TODO`).join("\n")],
  ["bash", "b2", { command: "ls /data" }, "sales.jsonl\n"],
  ["bash", "b3", { command: "true" }, ""],
  ["bash", "b4", { command: "curl -s example.invalid" }, longLine],
  ["edit", "e1", { path: "config.yml", edits: [{ oldText: "shape: box", newText: "shape: box\ntokenRate: true" }] }, "Successfully replaced 3 block(s) in config.yml.", false, { diff: diff.diff, firstChangedLine: diff.firstChangedLine }],
  ["edit", "e2", { path: "config.yml", edits: [{ oldText: "missing", newText: "x" }] }, "Could not find the exact text in config.yml.", true],
  ["edit", "e3", { path: "old.yml", edits: [{ oldText: "a", newText: "b" }] }, "Successfully replaced 1 block(s) in old.yml."],
  ["write", "w1", { path: "src/settings.ts", content: tsSource }, "Successfully wrote to src/settings.ts"],
  ["write", "w2", { path: "notes.zzz", content: "plain\nnotes\n" }, "Successfully wrote to notes.zzz"],
  ["read", "r1", { path: "src/settings.ts", offset: 4, limit: 24 }, `${tsSource.split("\n").slice(3, 27).join("\n")}\n\n[Showing lines 4-27 of 200. Use offset=28 to continue.]`],
  ["web_search", "g1", { query: "lezer highlightTree", limit: 3 }, JSON.stringify({ results: 3 })],
  ["todo_list", "t1", { action: "write" }, "Write 2 items"],
  ["outer_ui", "p1", { n: 1 }, "outer done", false, undefined, { complete: true, calls: [{ id: "p1/1", name: "inner", status: "ok" }] }],
];
const messages = [{ role: "user", content: [{ type: "text", text: "go" }], timestamp: now - 90_000 }];
for (const [i, [name, id, args, out, isError, details, nested]] of calls.entries()) {
  messages.push({ role: "assistant", content: [{ type: "text", text: "步骤" }, { type: "toolCall", id, name, arguments: args }], timestamp: now - 80_000 + i * 4000, stopReason: "toolUse" });
  messages.push({ role: "toolResult", toolCallId: id, toolName: name, content: [{ type: "text", text: out }], isError: isError === true, ...(details ? { details } : {}), ...(nested ? { nestedCalls: nested } : {}), timestamp: now - 80_000 + i * 4000 + 500 });
}
// A call whose arguments were still streaming (not valid JSON) and has no result yet.
messages.push({ role: "assistant", content: [{ type: "toolCall", id: "s1", name: "bash", arguments: '{"command": "echo hi' }], timestamp: now - 5000, stopReason: "toolUse" });
messages.push({ role: "assistant", content: [{ type: "text", text: "完成。" }], timestamp: now - 1000, stopReason: "stop" });

const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
const render = { streamId: "mock-s1", revision: 2, status: [], notifications: [], widgets: [], prompts: [], messages: {}, entries: [], toolErrors: {}, rendererErrors: [], tools: {
  t1: { shell: "default", call: nodeText("todo_list Write 2 items"), result: nodeText("Write 2 items", "○ a", "○ b") },
  p1: { shell: "default", call: nodeText("outer_ui call"), result: nodeText("outer result") },
} };
const snapshot = { streamId: "mock-s1", sessionId: "w1", sequence: 5, state: "idle", messages, queuedMessages: { steering: [], followUp: [] }, model: "clp/gpt-6", thinkingLevel: "medium", contextUsage: { tokens: 1000, contextWindow: 200_000, percent: 1 }, recentOperations: [], messageEntryIds: messages.map((_, index) => `e${index}`), extensionUi };
const sessions = [{ label: "tool bodies", sessionId: "w1", state: "idle", target: "alpha", cwd: "/data" }];
const catalog = { version: 1, target: { identity: "w1", streamId: snapshot.streamId, sessionId: "w1", state: "idle", readOnly: false, local: false, target: "alpha", current: { toolMode: "code" } }, commands: [], actions: [{ name: "tool-mode", effect: "session", risk: "low", enabled: true }], inputPrefixes: [{ prefix: "/", enabled: true, kind: "native-command" }], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const errors = [];
async function open(viewport, scheme) {
  const { context, page, problems } = await openMockWorkbench(browser, server.url, {
    viewport, colorScheme: scheme, mobile: viewport.width < 500, sessions, snapshots: { w1: snapshot },
    storage: { "pi-session-theme": scheme },
    routes: {
      "/api/sessions/w1/native": (body) => {
        if (!body.action) return catalog;
        const data = body.action === "extension-ui"
          ? body.args?.operation === "render" ? render : { streamId: snapshot.streamId, status: "completed", extensionUi }
          : { streamId: snapshot.streamId };
        return { requestId: body.requestId, action: body.action, status: "completed", message: "ok", data };
      },
    },
  });
  if (viewport.width < 500) await page.locator("#open-sidebar").click();
  await selectSession(page, "w1");
  await page.locator("#chat-tool-mode").waitFor();
  await page.locator("#chat-tool-mode").click();
  assert.deepEqual(await page.locator("[data-tool-mode]").evaluateAll((nodes) => nodes.map((node) => node.dataset.toolMode)), ["code", "direct"]);
  await page.keyboard.press("Escape");
  await openSessionDetails(page, "w1", { touch: false });
  assert.equal(await page.locator('#chat-local-tools[data-local="false"]').count(), 1, "Remote sessions render the same native-tools switch");
  await closeSessionDetails(page);
  await page.locator("details.pi-turn-process").first().waitFor();
  const turn = page.locator("details.pi-turn-process").first();
  if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
  // Rows animate open one after another; wait for each before the next click.
  for (const summary of await page.locator(".pi-tool > summary").all()) { await summary.click(); await page.waitForTimeout(80); }
  await page.mouse.move(0, 0);
  return { page, context, problems };
}

const tool = (page, id) => page.locator(`.pi-tool[data-tool-key$=":${id}"]`);
const rows = (locator) => locator.locator(".pi-cl").count();
const fold = (locator) => locator.locator('[data-action="expand-lines"]').first();
const hiddenOf = async (locator) => Number(await fold(locator).getAttribute("data-hidden-lines"));

for (const [tag, viewport, scheme] of [["desktop-dark", { width: 1440, height: 2600 }, "dark"], ["desktop-light", { width: 1440, height: 2600 }, "light"], ["phone-dark", { width: 390, height: 5200 }, "dark"], ["phone-light", { width: 390, height: 5200 }, "light"]]) {
  const { page, context, problems } = await open(viewport, scheme);
  const check = async () => {
    // --- python (kernel_code): numbered, highlighted, folded; no inner scroll
    const k1 = tool(page, "k1");
    await k1.locator(".code-block .tok-keyword").first().waitFor({ state: "attached" });
    assert.equal(await k1.locator(".pi-io").getAttribute("data-kind"), "kernel_code");
    assert.equal(await rows(k1.locator(".code-block")), TOOL_FOLD_LINES, "long code shows the first N lines");
    assert.equal(await hiddenOf(k1.locator(".pi-io")) >= 1, true);
    assert.equal(await k1.locator(".output-block .pi-cl").count(), TOOL_FOLD_LINES, "long output folds too");
    // --- nested summary (SDK record shape), below the code, failed marked
    const nestedOf = (locator) => locator.locator(".pi-nested-call").evaluateAll((nodes) => nodes.map((node) => ({ name: node.dataset.name, count: Number(node.dataset.count), failed: node.dataset.status === "error" })));
    assert.deepEqual(await nestedOf(k1), nestedSummary({ nestedCalls }));
    assert.equal(await k1.locator(".pi-io > .pi-nested-calls").count(), 1, "summary is the last row of the card");
    assert.equal(await nestedOf(tool(page, "b1")).then((items) => items.length), 0, "no summary without nestedCalls");
    // --- fold expands in place and restores exact text
    const pyBlock = k1.locator(".code-block");
    await fold(k1.locator(".pi-io")).first().click();
    assert.equal(await pyBlock.textContent(), pyCode, "expanded code is the exact input");
    assert.equal(await rows(pyBlock), pyCode.split("\n").length);
    // --- bash: `$` command once, header without the command, Timeout only
    const b1 = tool(page, "b1");
    assert.equal(await b1.locator("summary .pi-tool-args").count(), 0, "bash header has no command");
    assert.equal(await b1.locator(".pi-cl-prompt").textContent(), "grep -rn TODO . | head -n 30");
    assert.equal(await b1.locator('.pi-io-note[data-kind="meta"]').count(), 1, "timeout argument: one meta line");
    assert.equal(Number(await b1.locator('.pi-io-note[data-kind="meta"]').getAttribute("data-timeout-seconds")), 300);
    assert.equal(await hiddenOf(b1.locator(".pi-io")), 30 - TOOL_FOLD_LINES);
    assert.equal(await tool(page, "b2").locator(".pi-io-note").count(), 0, "no timeout argument: no meta line");
    assert.equal(await tool(page, "b2").locator(".output-block").textContent(), "sales.jsonl\n", "output text is exact, trailing newline included");
    assert.equal(await tool(page, "b2").locator(".output-block .pi-cl").count(), 1, "a trailing newline is not an extra row");
    assert.equal(await tool(page, "b3").locator(".output-block").count(), 1, "empty output still has an Output block");
    // very long single line wraps inside the card (no horizontal scroll)
    const b4 = tool(page, "b4");
    assert.equal(await b4.locator(".output-block").textContent(), longLine);
    assert(await b4.locator(".output-block").evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "long line wraps");
    // --- edit: counts in the header equal the +/- rows
    const e1 = tool(page, "e1");
    const stat = e1.locator(".pi-tool-diffstat");
    assert.deepEqual([Number(await stat.getAttribute("data-add")), Number(await stat.getAttribute("data-del"))], [diffExpect.add, diffExpect.del]);
    assert.equal(await e1.locator(".pi-cl-diff .pi-cl").count(), TOOL_FOLD_LINES);
    await fold(e1).click();
    assert.equal(await e1.locator(".pi-cl-diff .is-add").count(), diffExpect.add);
    assert.equal(await e1.locator(".pi-cl-diff .is-del").count(), diffExpect.del);
    assert.equal(await e1.locator(".pi-cl-diff .is-gap").count() > 0, true, "skipped ranges are marked");
    assert.equal(await e1.locator(".pi-cl-diff .tok-atom, .pi-cl-diff .tok-propertyName, .pi-cl-diff .tok-keyword, .pi-cl-diff [class*='tok-']").count() > 0, true, "diff text is highlighted (yaml)");
    assert.equal(await e1.locator(".output-block").count(), 0, "a successful edit with a diff has no separate output");
    // edit failure and old history (no diff): arguments + Output, no diff view
    for (const id of ["e2", "e3"]) {
      const body = tool(page, id);
      assert.equal(await body.locator(".pi-cl-diff").count(), 0);
      assert.equal(await body.locator(".pi-tool-diffstat").count(), 0);
      assert.equal(await body.locator(".output-block").count(), 1);
    }
    assert.equal(await tool(page, "e2").getAttribute("data-state"), "error");
    // --- write: highlighted + folded, Pi's own result text as a faint line, no Output rule
    const w1 = tool(page, "w1");
    await w1.locator(".code-block .tok-keyword").first().waitFor({ state: "attached" });
    assert.equal(await w1.locator(".pi-io-note").getAttribute("data-kind"), "write-result");
    assert.equal(await w1.locator(".pi-io-note").textContent(), "Successfully wrote to src/settings.ts", "the result text Pi returned, verbatim");
    assert.equal(await w1.locator(".pi-io-rule, .output-block").count(), 0);
    assert.equal(await hiddenOf(w1), tsSource.split("\n").length - TOOL_FOLD_LINES);
    await fold(w1).click();
    assert.equal(await w1.locator(".code-block").textContent(), tsSource);
    assert.equal(await w1.locator('[data-action="expand-lines"]').count(), 0, "button goes away once everything is shown");
    // unknown language: plain text, no tokens, nothing thrown
    const w2 = tool(page, "w2");
    assert.equal(await w2.locator(".code-block [class*='tok-']").count(), 0);
    assert.equal(await w2.locator(".code-block").textContent(), "plain\nnotes\n");
    // --- read: Pi's continuation notice is a separate faint line, not code, not numbered
    const r1 = tool(page, "r1");
    await r1.locator(".output-block .tok-keyword").first().waitFor({ state: "attached" });
    assert.equal(await r1.locator('.pi-io-note[data-kind="read-notice"]').textContent(), "[Showing lines 4-27 of 200. Use offset=28 to continue.]");
    assert.doesNotMatch(await r1.locator(".output-block").textContent(), /Showing lines/);
    assert.equal(await r1.locator("summary .pi-tool-args").textContent(), "src/settings.ts:4");
    assert.equal(await r1.locator(".output-block").evaluate((node) => getComputedStyle(node).counterReset), "pi-ln 3", "numbering starts at the read offset");
    await fold(r1).click();
    assert.equal(await r1.locator(".output-block .pi-cl").count(), 24, "the notice takes no row");
    // --- unadapted tool: compact JSON header, highlighted JSON input, Output rule + output
    const g1 = tool(page, "g1");
    assert.match(await g1.locator("summary .pi-tool-args").textContent(), /^\{"query":"lezer highlightTree","limit":3\}$/);
    await g1.locator(".code-block [class*='tok-']").first().waitFor({ state: "attached" });
    assert.equal(await g1.locator(".pi-io-rule").count(), 1);
    assert.equal(await g1.locator(".output-block").textContent(), JSON.stringify({ results: 3 }));
    // --- half-streamed arguments: plain text body, no highlighting, no structured kind
    const s1 = tool(page, "s1");
    assert.equal(await s1.locator(".pi-io").getAttribute("data-kind"), "generic");
    assert.equal(await s1.locator(".code-block [class*='tok-']").count(), 0);
    // --- plugin rows keep their own rendering (no card); nested summary sits under the plugin result
    const t1 = tool(page, "t1");
    assert.equal(await t1.locator(".pi-io").count(), 0);
    assert.equal(await t1.locator(".extension-tool-result").count(), 1);
    assert.equal(await nestedOf(t1).then((items) => items.length), 0);
    const p1 = tool(page, "p1");
    assert.equal(await p1.locator(".pi-io").count(), 0);
    assert.deepEqual(await nestedOf(p1), [{ name: "inner", count: 1, failed: false }]);
    assert.equal(await p1.locator(".pi-tool-body > .pi-nested-calls").count(), 1);
    // --- no scrollbars anywhere in a body
    const scrollers = await page.locator(".pi-tool-body").evaluateAll((bodies) => bodies.flatMap((body) => [...body.querySelectorAll(".pi-io, .pi-code-block, .pi-output-block")]).filter((node) => /auto|scroll/.test(getComputedStyle(node).overflowY) || /auto|scroll/.test(getComputedStyle(node).overflowX)).length);
    assert.equal(scrollers, 0, "tool cards have no inner scroll containers");
    await checkContrast(w1, scheme, tag);
  };
  await check();
  if (evidence) await page.screenshot({ path: join(evidence, `tool-bodies-${tag}.png`), fullPage: true });
  await context.close();
  errors.push(...problems);
  console.log(`PASS tool bodies ${tag}`);
}
assert.deepEqual(errors, [], "no page errors");
await browser.close();
await server.close();
console.log("PASS tool bodies: kinds, folding, notes, nested summary, plugin rows, boundary cases, contrast; light/dark, desktop/phone");
