// Use the real composer with loaded history; count the synchronous textarea reads, not machine-dependent timings.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { installRenderCounter, readRenderCounts, resetRenderCounts } from "../fixtures/workspace-mock/render-counter.mjs";

const messages = Array.from({ length: 160 }, (_, index) => ({
  role: index % 2 ? "assistant" : "user", stopReason: "stop", timestamp: Date.now() + index,
  content: [{ type: "text", text: `History ${index} **with formatting**.` }],
}));
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const { page, problems } = await openMockWorkbench(browser, server.url, {
    snapshots, search: "#sessionId=w1",
    beforeGoto: async (page) => {
      await installRenderCounter(page);
      await page.addInitScript(() => {
        const { get } = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
        Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
          get() { window.textareaScrollReads++; return get.call(this); },
        });
        window.textareaScrollReads = 0;
      });
    },
  });
  await page.locator(".pi-message[data-message-id]").nth(messages.length - 1).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const input = page.locator("textarea#composer");
  await input.focus();
  const height = () => input.evaluate((node) => node.offsetHeight);
  const single = await height();
  await page.evaluate(() => { window.textareaScrollReads = 0; });
  const cdp = await page.context().newCDPSession(page);
  const elements = await page.locator("#messages *").count();
  const updates = [];
  cdp.on("Tracing.dataCollected", ({ value }) => {
    for (const event of value) if (event.name === "UpdateLayoutTree") updates.push(event.args.elementCount);
  });
  await cdp.send("Tracing.start", { categories: "devtools.timeline" });
  for (const key of "abcdefghij") await page.keyboard.press(key);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const traced = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  await traced;
  await cdp.detach();
  assert(updates.length > 0, "the trace observed style updates");
  assert(Math.max(...updates) < elements / 2, `typing invalidated the transcript: max ${Math.max(...updates)} elements of ${elements} transcript elements`);
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.press("k");
  assert.equal(await input.inputValue(), "abcdefghij\nk");
  assert.equal(await page.evaluate(() => window.textareaScrollReads), 0, "typing must not synchronously measure textarea scrollHeight");
  assert(await height() > single, "a second line grows the textarea");
  await input.fill("line\n".repeat(40));
  assert(await height() <= 160, "long drafts cap the textarea height");
  assert(await input.evaluate((node) => node.scrollHeight > node.clientHeight), "overflow is scrollable");
  await input.fill("");
  assert.equal(await height(), single, "clearing the draft restores its single-line height");
  const viewport = page.locator("#transcript");
  const jump = page.locator("#new-messages");
  const atBottom = () => page.waitForFunction(() => {
    const node = document.getElementById("transcript");
    return node.scrollHeight - node.scrollTop - node.clientHeight < 2;
  });
  const savedTop = () => page.waitForFunction(() => {
    const saved = JSON.parse(sessionStorage.getItem(`${location.origin}/api:sessions-v1:session:w1`));
    const current = document.getElementById("transcript").scrollTop;
    return saved && Math.abs(saved.presentation.scrollTop - current) < 1;
  });
  if (await jump.isVisible()) await jump.click();
  await atBottom();
  await viewport.hover();
  await resetRenderCounts(page);
  await page.mouse.wheel(0, -450);
  await jump.waitFor();
  await savedTop();
  const touchedMessages = async () => Object.keys(await readRenderCounts(page)).filter((scope) => scope.startsWith("message:")).length;
  const scrollRenders = await touchedMessages();
  assert(scrollRenders < messages.length / 10, `saving scroll position re-rendered ${scrollRenders} messages`);
  await jump.click();
  await atBottom();
  await savedTop();
  const jumpRenders = await touchedMessages();
  assert(jumpRenders < messages.length / 10, `jumping re-rendered ${jumpRenders} messages`);
  await page.locator("#composer-add").click();
  await page.locator("#find-current-page").click();
  await page.locator("#transcript-search").fill("History 50");
  const match = page.locator(".pi-search-match");
  await match.waitFor();
  assert.match(await match.textContent(), /History 50/);
  const [scrollport, row] = await Promise.all([viewport.boundingBox(), match.boundingBox()]);
  assert(row.y >= scrollport.y && row.y + row.height <= scrollport.y + scrollport.height, "finding a loaded row scrolls it into view");
  assert.deepEqual(problems, []);
  console.log(`PASS composer input: no JS sizing; largest style update ${Math.max(...updates)} / ${elements} transcript elements; scroll / scroll plus jump touched ${scrollRenders} / ${jumpRenders} of ${messages.length} message rows`);
} finally {
  await browser.close();
  await server.close();
}
