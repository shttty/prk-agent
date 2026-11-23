// The monospace font in a real browser (check:full): Maple Mono CN drives every monospace surface (chat code blocks, tool
// input/output, the file editor, the terminal) with ligatures off; MesloLGS NF only fills the Nerd Font icon code points. It works with the machine's copy of Meslo (local(), no
// download) and without one (the bundled woff2). The API is mocked at the browser (tests/fixtures/workspace-mock.mjs).
// Nothing here locates by UI copy. Screenshots go to PI_TEST_WEB_EVIDENCE when it is set.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { layoutStorage } from "../fixtures/layout-code.mjs";
import { splitDockStorage } from "../fixtures/workspace-mock/split-dock-storage.mjs";

const MAPLE = "PRK Maple Mono CN";
const MESLO = "PRK MesloLGS NF";
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });

// A transcript with a fenced code block and one bash call (input and output blocks).
const now = Date.now();
const messages = [
  { role: "user", content: [{ type: "text", text: "go" }], timestamp: now - 9000 },
  { role: "assistant", content: [{ type: "text", text: "look" }, { type: "toolCall", id: "b1", name: "bash", arguments: { command: "ls /data" } }], timestamp: now - 8000, stopReason: "toolUse" },
  { role: "toolResult", toolCallId: "b1", toolName: "bash", content: [{ type: "text", text: "sales.jsonl\nnotes.txt" }], timestamp: now - 7000 },
  { role: "assistant", content: [{ type: "text", text: "```js\nconst total = items.length >= 0 ? a => b : null;\n```" }], timestamp: now - 6000, stopReason: "stop" },
];
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
const catalog = { version: 1, commands: [], actions: [], inputPrefixes: [{ prefix: "/", enabled: true }], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };
// main.py in one dock group and the terminal tab in another: both surfaces are on screen at once.
const OPEN = { ...layoutStorage({ workspaceOpen: true }), ...splitDockStorage("w1", "main.py") };

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const done = [];
async function step(name, run) {
  const t0 = Date.now();
  await run();
  done.push(name);
  console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

const first = (page, selector) => page.locator(selector).first().evaluate((node) => getComputedStyle(node).fontFamily.split(",")[0].trim().replace(/^"|"$/g, ""));
const requested = (page) => page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
const SURFACES = { "chat code block": ".pi-markdown pre code", "tool input": ".pi-code-block", "tool output": ".pi-output-block", "file editor": ".pi-file-editor .cm-scroller", terminal: ".pi-term .xterm-rows" };
/** Which platform fonts (PostScript names) painted this node, asked through CDP. */
async function platformFonts(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    assert.ok(nodeId, `${selector} exists`);
    return (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts.map((font) => font.postScriptName);
  } finally { await cdp.detach(); }
}
/** Open the workbench on w1 with the file editor and the terminal shown and every tool row expanded. */
async function open(options = {}) {
  const phone = Boolean(options.mobile);
  const handle = await openMockWorkbench(options.engine ?? browser, server.url, { fs: createMockFs({ "main.py": "print('hi')\n" }), snapshots, terminals: [{ name: "shell" }], routes: { "/api/sessions/w1/native": () => catalog }, storage: phone ? {} : OPEN, viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, beforeGoto: (page) => page.addInitScript(() => performance.setResourceTimingBufferSize(5000)), ...options });
  const { page } = handle;
  if (phone) await page.locator("#open-sidebar").click();
  await selectSession(page, "w1");
  await page.locator("details.pi-turn-process").first().waitFor();
  const turn = page.locator("details.pi-turn-process").first();
  if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
  for (const summary of await page.locator(".pi-tool > summary").all()) { await summary.click(); await page.waitForTimeout(80); }
  return handle;
}
/** The saved split dock mounts main.py in CodeMirror beside the terminal's xterm. */
async function openSurfaces(page) {
  await page.locator(".pi-term .xterm").waitFor();
  await page.locator(".pi-file-editor .cm-scroller").waitFor();
}
async function expectSurfaces(page, family, label) {
  for (const [name, selector] of Object.entries(SURFACES)) assert.equal(await first(page, selector), family, `${label}: ${name} uses ${family}`);
}
const lastCols = (sockets) => [...sockets[0].received].reverse().find((frame) => frame.type === "resize")?.cols;
async function until(read, ok, what) {
  for (let round = 0; round < 100; round += 1) {
    const value = await read();
    if (ok(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
}
/** xterm cell width in px: the width its rows span divided by the columns the terminal fitted. */
const cellWidth = async (page, cols) => (await page.locator(".pi-term .xterm-screen").evaluate((node) => node.getBoundingClientRect().width)) / cols;
async function shot(page, name) {
  if (!evidence) return;
  await page.waitForTimeout(450); // dialog and dropdown transitions
  await page.screenshot({ path: join(evidence, `${name}.png`) });
}

try {
  await step("default: Maple Mono CN everywhere, ligatures off, Meslo from the machine copy without a download", async () => {
    const { page, context, problems } = await open();
    await openSurfaces(page);
    await expectSurfaces(page, MAPLE, "default");
    for (const selector of [".pi-markdown pre code", ".pi-code-block", ".pi-output-block", ".pi-file-editor .cm-scroller", ".pi-term .xterm"]) {
      assert.equal(await page.locator(selector).first().evaluate((node) => getComputedStyle(node).fontVariantLigatures), "none", `ligatures off: ${selector}`);
    }
    await page.waitForFunction((family) => document.fonts.check(`13px "${family}"`) && [...document.fonts].some((face) => face.family.replace(/"/g, "") === family && face.status === "loaded"), MAPLE);
    // The machine has MesloLGS NF installed: local() serves it and the bundled file is never requested.
    assert.deepEqual((await requested(page)).filter((url) => /MesloLGS-NF/.test(url)), [], "no Meslo download when the font is installed");
    assert.deepEqual(problems, []);
    await context.close();
  });

  await step("without a local copy the bundled woff2 files load: Maple draws text, Meslo only icons", async () => {
    // The machine has ttf-meslo-nerd, which would hide a broken bundle: start Chromium with a fontconfig that lists
    // only the Noto directories.
    const dir = mkdtempSync(join(tmpdir(), "prk-fontconfig-"));
    let bare;
    try {
      const notoDirs = readdirSync("/usr/share/fonts").filter((name) => name.startsWith("noto")).map((name) => `/usr/share/fonts/${name}`);
      writeFileSync(join(dir, "fonts.conf"), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>${notoDirs.map((path) => `<dir>${path}</dir>`).join("")}<cachedir>${dir}/cache</cachedir></fontconfig>`);
      const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
      bare = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"], env: { ...process.env, FONTCONFIG_FILE: join(dir, "fonts.conf") } });
      const { page, context, sockets, problems } = await open({ engine: bare, terminalReplay: "\uF07C ~/work 你好 abc\r\n\x1b[3mitalic 斜体\x1b[0m\r\n" });
      await openSurfaces(page);
      await page.waitForFunction((family) => document.fonts.check(`13px "${family}"`) && [...document.fonts].some((face) => face.family.replace(/"/g, "") === family && face.status === "loaded"), MESLO);
      assert.ok((await requested(page)).some((url) => /MesloLGS-NF-Regular.*\.woff2/.test(url)), "the bundled file was requested for the icon code point");
      await expectSurfaces(page, MAPLE, "bundled");
      // Terminal row 1 holds an icon (private use area), Latin and Chinese: Meslo paints the icon, Maple everything else.
      const row = ".pi-term .xterm-rows > div:nth-child(1)";
      await page.locator(row).filter({ hasText: "abc" }).waitFor();
      const fonts = await platformFonts(page, row);
      assert.ok(fonts.some((name) => /^MesloLGS-NF/.test(name)), `the icon is painted by Meslo (${fonts})`);
      assert.ok(fonts.some((name) => name === "MapleMono-CN-Regular"), `Latin and Chinese are painted by Maple (${fonts})`);
      assert.deepEqual(fonts.filter((name) => !/^MesloLGS-NF|^MapleMono-CN-/.test(name)), [], "nothing else paints the terminal row");
      // A real italic face, never Regular skewed by the browser.
      const italic = await platformFonts(page, ".pi-term .xterm-rows > div:nth-child(2)");
      assert.ok(italic.includes("MapleMono-CN-Italic"), `italic uses Maple's italic face (${italic})`);
      // The system has no MesloLGS NF here, so only the bundle can draw its powerline glyphs (private-use code points).
      const widths = await page.evaluate((family) => {
        const measure = (font) => { const context = document.createElement("canvas").getContext("2d"); context.font = `100px ${font}`; return context.measureText("\uE0B0\uE0A0\uF101").width; };
        return { system: measure('"MesloLGS NF", monospace'), fallback: measure("monospace"), bundled: measure(`"${family}", monospace`) };
      }, MESLO);
      assert.equal(widths.system, widths.fallback, "no installed MesloLGS NF in this browser");
      assert.ok(Math.abs(widths.bundled - 3 * 60) < 3, `bundled Meslo draws the glyphs at its own advance (${widths.bundled})`);
      assert.notEqual(widths.bundled, widths.fallback, "which the fallback cannot");
      assert.ok(await cellWidth(page, await until(() => lastCols(sockets), (cols) => cols > 0, "the first fit")) > 6, "the terminal measured with it");
      await shot(page, "default-bundled-meslo");
      assert.deepEqual(problems.filter((message) => !message.startsWith("download failed")), []);
      await context.close();
    } finally {
      await bare?.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
} finally {
  await browser.close();
  await server.close();
}
console.log(`PASS mono font browser suite (${done.length} steps)`);
