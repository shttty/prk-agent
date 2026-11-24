import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { installMessageRenderCounter } from "../../fixtures/browser/count-message-renders.mjs";

const idle = "#composer-form:not([data-busy])";
const stage = (name) => `#operation-state[data-stage="${name}"]`;

test("composer and viewport stay put through send, wait, thinking, output, tool and settlement", async (t) => {
  const release = Promise.withResolvers();
  const f = await browserFixture(t, { rate: 36, answer: async (context) => {
    if (context.messages.at(-1).role === "toolResult") return fauxAssistantMessage("Settled.");
    await release.promise;
    return fauxAssistantMessage([
      fauxThinking("Plan verification ".repeat(20)), fauxText("Steady layout ".repeat(20)),
      fauxToolCall("kernel_code", { code: "import asyncio\nawait asyncio.sleep(60)", yield_s: 30 }),
    ], { stopReason: "toolUse" });
  } });
  const id = await f.create();
  const gate = Promise.withResolvers();
  try {
    await f.open(id);
    await f.page.evaluate(() => document.fonts.ready);
    await f.page.locator("#composer").fill("Check layout");
    const geometry = () => f.page.evaluate(() => ["#composer", "#composer-form", "#transcript"].map((selector) => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return [x, y, width, height];
    }));
    const expected = await geometry();
    const unchanged = async (phase) => {
      const actual = await geometry();
      assert(actual.every((box, index) => box.every((size, axis) => Math.abs(size - expected[index][axis]) < 1)), `${phase}: ${JSON.stringify({ expected, actual })}`);
    };
    await f.page.route(`**/api/sessions/${id}/send`, async (route) => { await gate.promise; await route.continue(); });
    await f.page.locator("#send-message").click();
    await f.page.locator(stage("sending")).waitFor();
    await unchanged("admission");
    gate.resolve();
    await f.page.locator(stage("waiting")).waitFor();
    await unchanged("waiting");
    release.resolve();
    await f.page.locator(stage("thinking")).waitFor();
    await unchanged("thinking");
    await f.page.locator(stage("output")).waitFor();
    await unchanged("output");
    await f.page.locator(stage("tool")).waitFor();
    await unchanged("tool");
    await f.page.locator("#cancel-operation").click();
    await f.page.locator(idle).waitFor();
    await unchanged("settled");
  } finally { gate.resolve(); release.resolve(); }
});

test("typing and settlement do not rerender existing message action rows", async (t) => {
  const release = Promise.withResolvers();
  t.after(() => release.resolve());
  const f = await browserFixture(t, { init: async (page) => { await installMessageRenderCounter(page); await page.clock.install(); },
    answer: async ({ messages }) => {
      if (messages.filter((message) => message.role === "user").length > 52) await release.promise;
      return fauxAssistantMessage("Controlled reply.");
    },
  });
  const id = await f.create();
  for (let i = 0; i < 52; i++) {
    assert.equal((await f.complete(id, await f.send(id, `Historical question ${i} **formatted**`))).status, "completed");
  }
  await f.open(id);
  await f.page.locator("#messages .pi-message-user[data-entry-id]").first().waitFor();
  await f.page.locator('[data-action="load-history"]').evaluate((button) => button.click());
  await f.page.waitForFunction(() => document.querySelectorAll("#messages .pi-message-user[data-entry-id]").length === 52);
  const input = f.page.locator("#composer");
  await input.focus();
  await f.page.clock.pauseAt((await f.page.evaluate(() => Date.now())) + 500);
  await f.page.clock.runFor(32);
  const setupRenders = await f.page.evaluate(() => window.__messageRenders.read().reduce((sum, commit) => sum + (commit.MessageView ?? 0), 0));
  assert(setupRenders >= 52, `counter must observe setup renders, got ${setupRenders}`);
  await f.page.evaluate(() => window.__messageRenders.reset());
  await input.pressSequentially("Compose without touching history");
  assert.equal(await input.inputValue(), "Compose without touching history");
  await f.page.clock.runFor(32);
  const commits = await f.page.evaluate(() => window.__messageRenders.read());
  const compose = commits.filter((event) => event.Composer || event.ComposerDock);
  assert(compose.length > 0, "counter must observe composer renders while typing");
  const history = compose.filter((event) => event.MessageView || event.MessageActions);
  assert.deepEqual(history, [], "typing must not cause commits in existing history");

  await f.page.clock.resume();
  try {
    const receipt = await f.send(id, "Observe control settlement");
    const retry = '[data-action="retry-message"]';
    await f.page.locator(`${retry}:disabled`).first().waitFor({ state: "attached" });
    await f.page.evaluate(() => window.__messageRenders.reset());
    release.resolve();
    assert.equal((await f.complete(id, receipt)).status, "completed");
    await f.page.locator(idle).waitFor();
    await f.page.locator(`${retry}:not(:disabled)`).first().waitFor({ state: "attached" });
    const settled = await f.page.evaluate(() => window.__messageRenders.read());
    assert(settled.every((event) => (event.MessageActions ?? 0) <= 2), JSON.stringify(settled));
  } finally { release.resolve(); }
});
