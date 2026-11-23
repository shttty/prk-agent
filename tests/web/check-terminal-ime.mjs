// Real Chromium IME, PRK history and terminal socket, and a local PTY owned by this fixture.
import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPtyBrowserFixture } from "../fixtures/pty-browser/create-fixture.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";

const turns = 180;
const updates = ["n", "ni", "ni h", "ni ha", "ni hao", "你好", "你好终", "你好终端"];
const english = "abcdabcd";
const terminal = '.pi-term[data-shell="shell"]';
const transcriptUser = "#messages .pi-message-user[data-entry-id]";
const now = Date.now() - turns * 2;
const firstSessionMessages = Array.from({ length: turns }, (_, index) => [
  { role: "user", timestamp: now + index * 2, content: `Question ${index}: **format** [link](https://example.com)` },
  fauxAssistantMessage(`History ${index}: **format** [link](https://example.com)\n\n1. One\n2. Two\n3. Three\n\n| a | b |\n| - | - |\n| foo | bar |\n\n\`\`\`js\nconsole.log(1)\n\`\`\``, { timestamp: now + index * 2 + 1 }),
]).flat();

for (const key of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) assert(process.env[key], `${key} is required`);
const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
const fixture = await createPtyBrowserFixture({ firstSessionMessages });
let server, browser;
try {
  server = await startWebDev(fixture.url);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url);
  await page.locator(`[data-session-id="${fixture.sessions[0].sessionId}"] .management-session-select`).click();
  await page.locator(transcriptUser).first().waitFor();
  while (await page.locator(transcriptUser).count() < turns) {
    const count = await page.locator(transcriptUser).count();
    await page.locator('[data-action="load-history"]').evaluate((button) => button.click());
    await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length > count, { selector: transcriptUser, count });
  }
  assert.equal(await page.locator("#messages :is(.pi-message-user, .pi-message-assistant)[data-message-id]").count(), turns * 2);
  const transcriptElements = await page.locator("#messages *").count();
  await page.locator("#toggle-workspace").click();
  const shell = page.locator(terminal);
  await shell.locator('.pi-term-view[data-status="connected"]').waitFor();
  await shell.locator(".xterm-cursor").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shell.locator("textarea.xterm-helper-textarea").focus();
  const frames = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.keyboard.insertText("printf '\\nIME_RESULT=<%s>\\n' '");
  await frames();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("DOM.enable");
  const englishTrace = await traceInput(cdp, "keydown", async () => {
    for (const key of english) { await page.keyboard.press(key); await frames(); }
  });
  await shell.locator(".xterm-rows").filter({ hasText: english }).waitFor();
  await frames();
  const imeTrace = await traceInput(cdp, "compositionupdate", async () => {
    for (const text of updates) {
      await cdp.send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
      await frames();
    }
  });
  assert.equal(englishTrace.length, english.length);
  assert.equal(imeTrace.length, updates.length);
  const roots = [...new Set(imeTrace.flatMap(({ layouts }) => layouts.flatMap(({ roots }) => roots)))];
  const rootNames = await Promise.all(roots.map(async (backendNodeId) => {
    const { object: { objectId } } = await cdp.send("DOM.resolveNode", { backendNodeId, objectGroup: "ime-trace" });
    const { result } = await cdp.send("Runtime.callFunctionOn", { objectId, returnByValue: true,
      functionDeclaration: `function (selector) { return { node: this.nodeName, classes: this.className, inside: !!this.closest?.(selector) }; }`, arguments: [{ value: terminal }] });
    return result.value;
  }));
  await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "ime-trace" });
  console.log(JSON.stringify({ chromium: browser.version(), transcriptElements, englishTrace, imeTrace, rootNames }));

  const composition = shell.locator(".composition-view.active");
  await composition.waitFor();
  assert.equal((await composition.textContent()).replaceAll("\u200E", ""), updates.at(-1));
  const { x, y, width, height } = await composition.boundingBox();
  const anchor = await shell.locator("textarea.xterm-helper-textarea").boundingBox();
  const cursor = await shell.locator(".xterm-cursor").boundingBox();
  const screen = await shell.locator(".xterm-screen").boundingBox();
  assert(width > 1 && height > 1 && x >= screen.x && y >= screen.y && x + width <= screen.x + screen.width + 1 && y + height <= screen.y + screen.height + 1,
    `preedit stays within the terminal screen: ${JSON.stringify({ x, y, width, height, screen })}`);
  for (const key of ["x", "y"]) {
    assert(Math.abs(anchor[key] - ({ x, y })[key]) <= 1, `IME textarea and preedit share their ${key} origin`);
    assert(Math.abs(cursor[key] - ({ x, y })[key]) <= height, `preedit follows the terminal cursor on ${key}`);
  }
  await cdp.send("Input.insertText", { text: updates.at(-1) });
  await composition.waitFor({ state: "hidden" });
  await frames();
  await page.keyboard.insertText("'");
  await page.keyboard.press("Enter");
  await shell.locator(".xterm-rows").filter({ hasText: `IME_RESULT=<${english}${updates.at(-1)}>` }).waitFor();
  assert.deepEqual(errors, []);

  assert(roots.length > 0 && imeTrace.every(({ layouts }) => layouts.length > 0 && layouts.every(({ roots }) => roots.length > 0)),
    "each compositionupdate must exercise Chromium's synchronous layout");
  assert(rootNames.every(({ inside }) => inside), `compositionupdate laid out nodes outside the terminal: ${JSON.stringify(rootNames)}`);
  console.log("PASS: compositionupdate layouts stay inside the terminal, preedit and textarea anchor follow the cursor, and committed Chinese reaches the real PTY exactly once");
} finally {
  try { await browser?.close(); }
  finally { try { await server?.close(); } finally { await fixture.close(); } }
}

async function traceInput(cdp, type, run) {
  const events = [];
  const collect = ({ value }) => events.push(...value);
  cdp.on("Tracing.dataCollected", collect);
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline" });
  try { await run(); }
  finally {
    const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    await cdp.send("Tracing.end");
    await done;
    cdp.off("Tracing.dataCollected", collect);
  }
  return events.filter((event) => event.name === "EventDispatch" && event.ph === "X" && event.args.data?.type === type).map((event) => {
    const inside = (item) => item.ph === "X" && item.pid === event.pid && item.tid === event.tid && item.ts >= event.ts && item.ts + item.dur <= event.ts + event.dur;
    const nested = events.filter(inside);
    return {
      handlerMs: event.dur / 1000,
      styles: nested.filter(({ name }) => name === "UpdateLayoutTree").map(({ dur, args }) => ({ ms: dur / 1000, elements: args.elementCount })),
      layouts: nested.filter(({ name }) => name === "Layout").map(({ dur, args }) => ({ ms: dur / 1000, dirty: args.beginData?.dirtyObjects,
        total: args.beginData?.totalObjects, roots: args.endData?.layoutRoots?.map(({ nodeId }) => nodeId) ?? [] })),
    };
  });
}
