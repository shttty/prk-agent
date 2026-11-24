import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";

const viewport = "#transcript";
const pager = '[data-action="load-history"]';
const idle = "#composer-form:not([data-busy])";

async function scrollUp(page, top) {
  await page.locator(viewport).evaluate((node, offset) => {
    node.scrollTop = offset;
    node.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, bubbles: true }));
  }, top);
}

async function prependLastPage(page) {
  await scrollUp(page, 25);
  await page.locator(pager).waitFor();
  return page.locator(pager).evaluate(async (button) => {
    const viewport = document.querySelector("#transcript");
    const viewportTop = viewport.getBoundingClientRect().top;
    const first = [...viewport.querySelectorAll(".pi-message")].find((node) => node.getBoundingClientRect().bottom > viewportTop + 2);
    const selector = `[data-message-id="${CSS.escape(first.dataset.messageId)}"]`;
    const offsets = [first.getBoundingClientRect().top];
    button.click();
    const deadline = performance.now() + 3000;
    let complete = 0;
    while (performance.now() < deadline && complete < 2) {
      await new Promise(requestAnimationFrame);
      const current = viewport.querySelector(selector);
      offsets.push(current?.getBoundingClientRect().top);
      if (!button.isConnected) complete++;
    }
    return { offsets, complete };
  });
}

test("long transcript preserves prepend and restore anchors, reveals off-window rows, and follows streaming output", async (t) => {
  const f = await browserFixture(t, { rate: 40, answer: ({ messages }) => fauxAssistantMessage(
    text(messages.at(-1)) === "Observe pinned streaming" ? "Pinned frame evidence. **Visible** text across several lines.\n\n".repeat(18) : "Fixture reply.",
  ) });
  const id = await f.create();
  for (let i = 0; i < 52; i++) {
    assert.equal((await f.complete(id, await f.send(id, `Fixture turn ${i.toString().padStart(2, "0")}.`))).status, "completed");
  }
  const { page } = f;
  const row = (i) => page.locator(".pi-message-user[data-entry-id]").filter({ hasText: `Fixture turn ${i}.` });
  await f.open(id);
  await page.locator("#new-messages").click();
  await row("51").waitFor();
  assert.equal(await row("02").count(), 0, "loaded but off-window");
  const { offsets, complete } = await prependLastPage(page);
  assert.equal(complete, 2, "the last page removed its pagination row");
  assert(offsets.every(Number.isFinite), JSON.stringify(offsets));
  assert(Math.abs(offsets.at(-1) - offsets[0]) <= 2, JSON.stringify(offsets));
  assert(offsets.slice(1).every((offset, index) => Math.abs(offset - offsets[index]) <= 8), JSON.stringify(offsets));

  await page.locator("#composer").focus();
  await page.keyboard.press("Control+f");
  const input = page.locator("#transcript-search");
  await input.waitFor();
  assert.equal(await row("32").count(), 0, "search target starts outside the window");
  await input.fill("Fixture turn 32.");
  await page.locator('[role="search"][data-status="ready"][data-count="1"]').waitFor();
  await row("32").and(page.locator(".pi-search-match")).waitFor();
  await page.waitForFunction(() => {
    const v = document.querySelector("#transcript").getBoundingClientRect();
    const target = document.querySelector(".pi-search-match")?.getBoundingClientRect();
    return target && Math.abs((v.top + v.bottom - target.top - target.bottom) / 2) <= 3;
  });
  await input.press("Escape");
  const offset = () => row("32").evaluate((node) => node.getBoundingClientRect().top - document.querySelector("#transcript").getBoundingClientRect().top);
  const saved = await offset();
  const other = await f.create("Other conversation");
  await page.locator(`[data-session-id="${other}"]`).first().click();
  await page.waitForFunction((other) => location.hash.includes(other), other);
  await page.locator(`[data-session-id="${id}"]`).first().click();
  await page.waitForFunction((id) => location.hash.includes(id), id);
  await row("32").waitFor();
  assert(Math.abs(await offset() - saved) <= 2, "session switch restores the saved message offset");

  const opened = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code: "import asyncio\nawait asyncio.sleep(60)", yield_s: 0 } })}`);
  assert.equal((await f.complete(id, opened)).status, "completed");
  const task = page.locator('#background-task-list [data-task-kind="kernel"]');
  await page.locator("#background-tasks-toggle").click();
  await task.waitFor();
  const cellId = await task.getAttribute("data-cell-id");
  const cell = page.locator(`[data-kind="kernel-cell"][data-cell-id="${cellId}"]`);
  await page.locator("#new-messages").evaluate((button) => button.click());
  await cell.waitFor({ state: "attached" });
  await scrollUp(page, 600);
  await cell.waitFor({ state: "detached" });
  await task.locator('[data-action="view"]').click();
  await cell.locator(":scope > summary").waitFor();
  assert.equal(await cell.getAttribute("open"), "");
  await task.locator('[data-action="interrupt"]').click();
  await task.waitFor({ state: "detached" });

  await page.locator("#composer").fill("Observe pinned streaming");
  await page.evaluate(() => {
    const v = document.querySelector("#transcript");
    const form = document.querySelector("#composer-form");
    const trace = { live: 0, worst: 0, done: false };
    window.pinnedTrace = trace;
    const sample = () => {
      if (form.hasAttribute("data-busy")) {
        trace.live += v.querySelector(".is-streaming .pi-markdown") ? 1 : 0;
        trace.worst = Math.max(trace.worst, v.scrollHeight - v.clientHeight - v.scrollTop);
      } else if (trace.live) { trace.done = true; return; }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator("#send-message").click();
  await page.waitForFunction(() => window.pinnedTrace.done);
  await page.locator(idle).waitFor();
  const trace = await page.evaluate(() => window.pinnedTrace);
  assert(trace.live > 1 && trace.worst <= 2, JSON.stringify(trace));
});
