// Real kernel -> SDK -> Gateway -> HTTP -> Vite -> Chromium; controlled provider only turns S4_CELL text into a kernel_code call.
// Asserts a real `_repr_png_` ImageContent renders as an <img> next to its result text, inline and after lazy "full content" load.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createTarget } from "./fixtures/create-target.mjs";
import { createWebFixture } from "./fixtures/create-web-fixture.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required`);

const png = (width, height) => String.raw`
import zlib, struct
def chunk(kind, data):
    body = kind + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
def make_png(w, h):
    rows = b''.join(b'\x00' + b''.join(bytes((x * 255 // max(w - 1, 1), y * 255 // max(h - 1, 1), 128)) for x in range(w)) for y in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
class Picture:
    def _repr_png_(self):
        return make_png(${width}, ${height})
Picture()
`;

const target = await createTarget("local");
let fixture, browser;
try {
  fixture = await createWebFixture(target);
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(fixture.url);
  await page.locator(`[data-session-id="${fixture.sessionId}"] .management-session-select`).click();
  await page.locator('#monitor-kernel[data-status="idle"]').waitFor();

  async function run(code) {
    const tools = page.locator("details.pi-tool");
    const before = await tools.count();
    await page.locator("#composer").fill(`S4_CELL ${JSON.stringify({ code })}`);
    await page.locator("#send-message").click();
    await page.waitForFunction((count) => document.querySelectorAll("details.pi-tool").length > count
      && document.querySelector("#monitor-kernel")?.dataset.status === "idle"
      && [...document.querySelectorAll("details.pi-tool")].at(-1).dataset.state === "done", before);
    const row = tools.last();
    const turn = row.locator('xpath=ancestor::details[contains(@class,"pi-turn-process")]');
    if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
    if (!await row.evaluate((node) => node.open)) await row.locator(":scope > summary").click();
    return row;
  }
  const decoded = (row) => row.locator(".pi-io-images img").evaluateAll((nodes) => nodes.map((node) => ({
    width: node.naturalWidth, height: node.naturalHeight, complete: node.complete, src: node.src, right: node.getBoundingClientRect().right,
  })));
  const realImage = (toolCallId) => page.evaluate(async ({ sessionId, id }) => {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/tool-content?toolCallId=${encodeURIComponent(id)}`);
    const body = await response.json();
    return body.result.content.filter((part) => part.type === "image").map((part) => ({ mimeType: part.mimeType, data: part.data }));
  }, { sessionId: fixture.sessionId, id: toolCallId });
  const lastToolCallId = () => page.evaluate(async (sessionId) => {
    const body = await (await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`)).json();
    return body.messages.filter((message) => message.role === "toolResult").at(-1).toolCallId;
  }, fixture.sessionId);

  // Small image: the snapshot carries the ImageContent inline, no extra click.
  const small = await run(png(1, 1));
  await small.locator(".pi-io-images img").waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".pi-tool .pi-io-images img")].at(-1).complete);
  const [dot] = await decoded(small);
  assert.deepEqual([dot.width, dot.height], [1, 1], "inline PNG decodes at its real size");
  assert((await small.locator(".output-block").textContent()).includes("Execution completed"), "result text stays beside the image");
  const smallReal = await realImage(await lastToolCallId());
  assert.equal(smallReal.length, 1);
  assert.equal(dot.src, `data:${smallReal[0].mimeType};base64,${smallReal[0].data}`, "img shows the SDK result image bytes");

  // Larger image: snapshot is the lazy text preview; the image arrives with the full tool content.
  const large = await run(png(160, 90));
  assert.equal(await large.locator(".pi-io-images").count(), 0, "lazy preview has no image before loading");
  await large.locator('[data-action="expand-lines"][data-total-bytes]').first().click();
  await large.locator(".pi-io-images img").waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".pi-tool .pi-io-images img")].at(-1).complete);
  const [wide] = await decoded(large);
  assert.deepEqual([wide.width, wide.height], [160, 90], "lazy-loaded PNG decodes at its real size");
  assert((await large.locator(".output-block").textContent()).includes("Execution completed"), "text and image coexist after loading");
  const largeReal = await realImage(await lastToolCallId());
  assert.equal(wide.src, `data:${largeReal[0].mimeType};base64,${largeReal[0].data}`);

  // Phone width: the image must stay inside the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await large.scrollIntoViewIfNeeded();
  const [narrow] = await decoded(large);
  assert(narrow.right <= 390, `image stays inside a 390px viewport, right=${narrow.right}`);

  if (process.env.PI_TEST_WEB_EVIDENCE) {
    await mkdir(process.env.PI_TEST_WEB_EVIDENCE, { recursive: true });
    await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, "tool-image-phone.png") });
    await page.setViewportSize({ width: 1360, height: 1000 });
    await large.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, "tool-image-desktop.png") });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ fixture: "real kernel/SDK/Gateway/HTTP/Vite/Chromium", inline: [dot.width, dot.height], lazy: [wide.width, wide.height], paidCalls: 0 }));
} finally {
  await browser?.close();
  await fixture?.close();
  await target.close();
}
