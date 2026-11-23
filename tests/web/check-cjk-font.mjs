// CJK text is drawn by bundled fonts only. Chromium runs with a fontconfig that lists no CJK font at all (a phone, another
// machine), then every element holding Chinese text (chat, tool code, Markdown code/inline code, editor, terminal rows,
// monitor, composer/placeholder, theme import box) is asked which platform font really painted it (CDP
// CSS.getPlatformFontsForNode): each must be a web font (`isCustomFont`), never a system face that fontconfig chose.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { snapshotOf, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { splitDockStorage } from "../fixtures/workspace-mock/split-dock-storage.mjs";

const code = "import json\n# 读取配置并打印结果\nprint('你好，世界')  # 中文注释\n";
const messages = [
  { role: "user", content: [{ type: "text", text: "请检查工具，并给出中文说明。" }], timestamp: 1000 },
  { role: "assistant", content: [{ type: "toolCall", id: "t1", name: "kernel_code", arguments: { code } }], stopReason: "toolUse", timestamp: 2000 },
  { role: "toolResult", toolCallId: "t1", toolName: "kernel_code", content: [{ type: "text", text: "你好，世界\n结果：完成" }], timestamp: 3000 },
  { role: "assistant", content: [{ type: "text", text: `## 结果说明\n\n行内代码 \`配置文件.json\` 与代码块：\n\n\`\`\`python\n${code}\`\`\`\n\n| 名称 | 说明 |\n| --- | --- |\n| 甲 | 乙 |\n` }], stopReason: "stop", timestamp: 4000 },
];
const snapshot = { ...snapshotOf("w1", "idle"), messages, messageEntryIds: messages.map((_, index) => `e${index}`) };
const sessions = SESSIONS.slice(0, 1).map((worker) => ({ ...worker, label: "中文会话名称" }));

// Latin-only system fonts: nothing that could draw a Chinese character.
const dir = mkdtempSync(join(tmpdir(), "prk-cjk-fontconfig-"));
let server, browser;

/** Every visible element that directly holds CJK text or a CJK placeholder, with the fonts that painted it. */
async function painted(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => ![...document.fonts].some((face) => face.status === "loading"));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const count = await page.evaluate(() => {
    const cjk = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
    document.querySelectorAll("[data-fprobe]").forEach((node) => node.removeAttribute("data-fprobe"));
    let index = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!cjk.test(node.nodeValue) || !element || element.closest("script,style") || !element.getClientRects().length || getComputedStyle(element).visibility === "hidden") continue;
      element.setAttribute("data-fprobe", String(index++));
    }
    for (const element of document.querySelectorAll("textarea[placeholder],input[placeholder]")) {
      if (cjk.test(element.placeholder) && element.getClientRects().length) element.setAttribute("data-fprobe", String(index++));
    }
    return index;
  });
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const rows = [];
  for (let index = 0; index < count; index++) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-fprobe="${index}"]` });
    if (!nodeId) continue; // re-rendered between marking and asking
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    const info = await page.locator(`[data-fprobe="${index}"]`).evaluate((node) => {
      const style = getComputedStyle(node);
      return { label: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}.${String(node.className).split(/\s+/)[0]}`, mono: style.fontFamily.startsWith('"PRK Maple Mono CN"'), italic: style.fontStyle === "italic" };
    });
    rows.push({ ...info, fonts });
  }
  await cdp.detach();
  return rows;
}
const system = (rows) => rows.flatMap(({ label, fonts }) => fonts.filter((font) => !font.isCustomFont).map((font) => `${label}: ${font.familyName} x${font.glyphCount}`));
// Monospace text (stack starts with Maple Mono CN) must be painted by Maple only: its Chinese and Latin, not Noto or Meslo.
const notMaple = (rows) => rows.filter(({ mono }) => mono).flatMap(({ label, fonts }) => fonts.filter((font) => !/^MapleMono-CN-/.test(font.postScriptName)).map((font) => `${label}: ${font.postScriptName} x${font.glyphCount}`));
// Italic monospace text must use Maple's own italic faces; a Regular face under font-style: italic would be skewed by the browser.
const synthesised = (rows) => rows.filter(({ mono, italic }) => mono && italic).flatMap(({ label, fonts }) => fonts.filter((font) => !/Italic$/.test(font.postScriptName)).map((font) => `${label}: ${font.postScriptName} x${font.glyphCount}`));

try {
  writeFileSync(join(dir, "fonts.conf"), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/usr/share/fonts/liberation</dir><cachedir>${dir}/cache</cachedir></fontconfig>`);
  for (const name of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required for browser tests`);
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  server = await startWebDev("http://127.0.0.1:9");
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"], env: { ...process.env, FONTCONFIG_FILE: join(dir, "fonts.conf") } });
  for (const [tag, scheme, viewport, mobile] of [["desktop", "light", { width: 1440, height: 900 }, false], ["phone", "dark", { width: 390, height: 844 }, true]]) {
    // desktop: the editor and the terminal tab in separate dock groups, both on screen
    const storage = mobile ? { "pi-session-theme": scheme } : { "pi-session-theme": scheme, "pi.layout.workspaceOpen": "true", ...splitDockStorage("w1", "代码.py") };
    const h = await openMockWorkbench(browser, server.url, { fs: createMockFs({ "说明.md": "# 标题\n", "代码.py": code }), sessions, snapshots: { w1: snapshot }, colorScheme: scheme, viewport, mobile, terminals: [{ name: "shell" }], terminalReplay: "$ echo 你好\r\n你好\r\n", storage, search: "#sessionId=w1" });
    const { page } = h;
    try {
      await page.locator(".pi-message").first().waitFor();
      await page.locator("details.pi-turn-process").first().locator(":scope > summary").click();
      await page.locator(".pi-tool").first().locator(":scope > summary").click();
      if (!mobile) {
        // The chat column is too narrow beside the workspace: the panel is folded to its button until unfolded.
        await page.locator("#toggle-monitor").click();
        await page.locator("#monitor-card").waitFor();
        await page.locator(".cm-content").first().waitFor();
        await page.locator(".pi-term .xterm-rows").first().waitFor();
      }
      await page.locator(".tok-comment").first().waitFor();
      const chat = await painted(page);
      assert(chat.length >= 10, `${tag}: the scene holds Chinese text in many places (${chat.length})`);
      assert(chat.some(({ label }) => /^code\b|^span\.tok-/.test(label)), `${tag}: monospace Chinese (code, comments) is part of the scene`);
      assert.deepEqual(system(chat), [], `${tag}: chat/tool/code/editor/terminal Chinese uses bundled fonts only`);
      assert(chat.some(({ mono }) => mono), `${tag}: monospace Chinese is part of the scene`);
      assert.deepEqual(notMaple(chat), [], `${tag}: monospace Chinese is drawn by Maple Mono CN`);
      assert(chat.some(({ mono, italic }) => mono && italic), `${tag}: italic monospace Chinese (code comments) is part of the scene`);
      assert.deepEqual(synthesised(chat), [], `${tag}: italic monospace Chinese uses a real italic face`);
      if (mobile) await page.locator("#open-sidebar").click();
      await page.locator("#open-settings").click();
      if (mobile) await page.locator('[data-settings-section="general"]').click();
      await page.locator("#theme-json").waitFor();
      const settings = await painted(page);
      assert(settings.some(({ label }) => label.startsWith("textarea#theme-json")), `${tag}: the theme import placeholder is part of the scene`);
      assert.deepEqual(system(settings), [], `${tag}: settings (theme import box) Chinese uses bundled fonts only`);
      assert.deepEqual(h.problems, [], `${tag}: no page errors`);
      console.log(`PASS cjk font ${tag}: ${chat.length + settings.length} Chinese-bearing elements, all drawn by bundled fonts`);
    } finally { await h.context.close(); }
  }
} finally {
  await browser?.close();
  await server?.close();
  await rm(dir, { recursive: true, force: true });
}
