// Real Chromium + Vite, synthetic session history: cold deep link, delayed grammar, SSE rerender,
// reload/session switch/theme change, and identical token colours in Markdown/tool bodies/CodeMirror.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";

const code = "import json\nprint(gateway.describe('web_search'))\n";
const messages = [
  { role: "user", content: [{ type: "text", text: "Inspect the available tool." }], timestamp: 1000 },
  { role: "assistant", content: [{ type: "toolCall", id: "highlight-code", name: "kernel_code", arguments: { code } }], stopReason: "toolUse", timestamp: 2000 },
  { role: "toolResult", toolCallId: "highlight-code", toolName: "kernel_code", content: [{ type: "text", text: "{}" }], timestamp: 3000 },
  { role: "assistant", content: [{ type: "text", text: `\`\`\`python\n${code}\`\`\`\n\n\`inline\`\n\n\`\`\`unknown-prk\nliteral <tag>\n\`\`\`` }], stopReason: "stop", timestamp: 4000 },
];
const snapshot = { ...snapshotOf("w1", "idle"), messages, messageEntryIds: messages.map((_, i) => `e${i}`) };
const markdown = ".assistant .pi-markdown pre code.language-python";
const toolCode = '.pi-tool[data-tool-key$=":highlight-code"] .code-block';
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

async function openTool(page) {
  const turn = page.locator("details.pi-turn-process").first();
  await turn.waitFor();
  if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
  const tool = page.locator('.pi-tool[data-tool-key$=":highlight-code"]');
  if (!await tool.evaluate((node) => node.open)) await tool.locator(":scope > summary").click();
}
async function colours(page, selector) {
  await page.locator(`${selector} .tok-keyword`).first().waitFor({ timeout: 5000 });
  return page.locator(selector).evaluate((root) => {
    const result = {};
    for (const name of ["keyword", "string"]) {
      const token = root.querySelector(`.tok-${name}`);
      const probe = document.createElement("span");
      probe.style.color = `var(--pi-syn-${name})`;
      root.append(probe);
      result[name] = { actual: getComputedStyle(token).color, expected: getComputedStyle(probe).color };
      probe.remove();
    }
    return result;
  });
}
async function checkColours(page, selector, label) {
  const values = await colours(page, selector);
  for (const [token, { actual, expected }] of Object.entries(values)) assert.equal(actual, expected, `${label}: ${token} uses the shared theme token`);
  return values;
}

try {
  for (const [tag, scheme, viewport] of [
    ["desktop-dark", "dark", { width: 1440, height: 1000 }],
    ["desktop-light", "light", { width: 1440, height: 1000 }],
    ["phone-dark", "dark", { width: 390, height: 1000 }],
  ]) {
    let release;
    let requested;
    const gate = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { requested = resolve; });
    const h = await openMockWorkbench(browser, server.url, {
      sessions: SESSIONS.slice(0, 2), snapshots: { w1: snapshot, w2: snapshotOf("w2", "idle") },
      fs: createMockFs({ "example.py": code }), colorScheme: scheme, viewport, mobile: viewport.width < 500,
      routes: { "/api/sessions/w1/native": () => ({ commands: [], actions: [], target: { identity: "w1", sessionId: "w1", streamId: snapshot.streamId, state: "idle" }, resources: [] }), "/api/sessions/w2/native": () => ({ commands: [], actions: [], target: { identity: "w2", sessionId: "w2", state: "idle" }, resources: [] }) },
      storage: { "pi-session-theme": scheme }, search: "#sessionId=w1",
      beforeGoto: (page) => page.route(/\/chat\/code\/highlight-lines\.js(?:\?|$)/, async (route) => { requested(); await gate; await route.continue(); }),
    });
    try {
      const { page } = h;
      await openTool(page);
      await started;
      assert.equal(await page.locator(`${toolCode} .tok-keyword`).count(), 0, `${tag}: cold module has not loaded yet`);
      // An existing SSE snapshot while import is pending must not strand an already-rendered block.
      await page.evaluate((value) => {
        for (const source of window.__eventSources.filter((entry) => /sessions\/w1\/events/.test(entry.url))) source.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(value) }));
      }, { ...snapshot, sequence: 2 });
      release();
      const toolColours = await checkColours(page, toolCode, `${tag} tool after lazy load`);
      const markdownColours = await checkColours(page, markdown, `${tag} Markdown after lazy load`);
      assert.deepEqual(markdownColours, toolColours, `${tag}: Markdown and tool share the same colours`);
      assert.equal(await page.locator(markdown).textContent(), code, "highlighting preserves literal source and its trailing newline");
      assert.equal(await page.locator("code.language-unknown-prk").textContent(), "literal <tag>\n");
      assert.equal(await page.locator("code.language-unknown-prk [class*='tok-']").count(), 0);
      if (evidence) await page.screenshot({ path: join(evidence, `highlight-${tag}.png`), fullPage: true });
      await page.reload();
      await openTool(page);
      await checkColours(page, markdown, `${tag} after refresh`);
      await checkColours(page, toolCode, `${tag} tool after refresh`);
      if (viewport.width >= 500) {
        await selectSession(page, "w2");
        await selectSession(page, "w1");
        await openTool(page);
        await checkColours(page, toolCode, `${tag} after session switch`);
        const summary = page.locator('.pi-tool[data-tool-key$=":highlight-code"] > summary');
        await summary.click();
        await summary.click();
        await checkColours(page, toolCode, `${tag} after fold/unfold`);
        await page.locator("#toggle-workspace").click();
        await page.locator("#toggle-tree").click();
        await page.locator('#file-tree li[data-path="example.py"] .pi-files-row').click();
        const editor = '.pi-file[data-path="example.py"] .cm-content';
        assert.deepEqual(await checkColours(page, editor, `${tag} editor`), toolColours, "CodeMirror uses the same highlighter and token palette");
        const other = scheme === "dark" ? "light" : "dark";
        await page.locator("#theme-toggle").click();
        await page.waitForFunction((value) => document.documentElement.dataset.mantineColorScheme === value, other);
        const changed = await checkColours(page, markdown, `${tag} switched theme`);
        assert.notEqual(changed.keyword.actual, toolColours.keyword.actual, "theme switch changes the painted keyword");
        assert.deepEqual(await checkColours(page, toolCode, `${tag} switched tool`), changed);
        assert.deepEqual(await checkColours(page, editor, `${tag} switched editor`), changed);
      }
      assert.deepEqual(h.problems, [], `${tag}: no page errors`);
      console.log(`PASS highlighting ${tag}: cold deep link + delayed load, SSE, refresh, shared token colours`);
    } finally { release(); await h.context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}
