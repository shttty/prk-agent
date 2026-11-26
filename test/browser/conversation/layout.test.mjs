import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { installMessageRenderCounter } from "../../fixtures/browser/count-message-renders.mjs";
import { until } from "../../fixtures/until.mjs";

const idle = "#composer-form:not([data-busy])";
const stage = (name) => `#operation-state[data-stage="${name}"]`;

test("composer and viewport stay put through send, wait, thinking, output, tool and settlement", async (t) => {
  const release = Promise.withResolvers();
  const f = await browserFixture(t, { rate: 36, answer: async (context) => {
    if (context.messages.at(-1).role === "toolResult") {
      const lastUser = context.messages.findLast((message) => message.role === "user");
      return fauxAssistantMessage(text(lastUser) === "Check folds" ? "Fold final." : "Settled.");
    }
    if (text(context.messages.at(-1)) === "Check folds") return fauxAssistantMessage([
      fauxText("Before tool, always visible."), fauxToolCall("kernel_code", { code: "print(42)" }),
    ], { stopReason: "toolUse" });
    await release.promise;
    return fauxAssistantMessage([
      fauxThinking("Plan verification ".repeat(20)), fauxText("Steady layout ".repeat(20)),
      fauxToolCall("kernel_code", { code: "import asyncio\nawait asyncio.sleep(5)" }),
      fauxText("Same assistant message after the call."),
    ], { stopReason: "toolUse" });
  } });
  const id = await f.create();
  const gate = Promise.withResolvers();
  try {
    await f.open(id);
    await f.page.locator("#open-settings").click();
    await f.page.locator("#open-visual-effects").click();
    await f.page.locator("#setting-stream-output").press("Space");
    assert.equal(await f.page.locator("#setting-stream-output").isChecked(), false);
    await f.page.locator("#setting-show-thinking").press("Space");
    assert.equal(await f.page.locator("#setting-show-thinking").isChecked(), false);
    await f.page.locator("#close-settings").click();
    await f.page.evaluate(() => document.fonts.ready);
    await f.page.locator("#composer").fill("Check layout");
    const captureRing = async (phase) => {
      const input = f.page.locator("#composer");
      await input.blur();
      const box = await f.page.locator("#composer-form").boundingBox();
      const clip = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y) - 2, width: 48, height: 2 };
      const unfocused = await f.page.screenshot({ clip, animations: "disabled" });
      await input.focus();
      const focused = await f.page.screenshot({ clip, animations: "disabled" });
      if (process.env.PI_TEST_WEB_EVIDENCE) await f.page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/composer-${phase}.png`, animations: "disabled" });
      return !focused.equals(unfocused);
    };
    const idleRing = await captureRing("idle");
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
    const waitingRing = await captureRing("waiting");
    assert.deepEqual({ idleRing, waitingRing }, { idleRing: true, waitingRing: true }, "focus must paint the ring above the composer while idle and waiting");
    release.resolve();
    await f.page.locator(stage("thinking")).waitFor();
    await unchanged("thinking");
    const buffered = f.page.locator('.pi-message-assistant[data-text-buffered="true"]');
    assert.equal(await f.page.locator(".pi-thinking").count(), 0);
    await f.page.locator(stage("output")).waitFor();
    await unchanged("output");
    await buffered.locator(".pi-message-status").waitFor();
    assert.equal(await buffered.locator(".pi-markdown").count(), 0);
    await f.page.locator(stage("tool")).waitFor();
    await unchanged("tool");
    await buffered.locator('.pi-turn-process[open][data-state="running"] [data-tool-name="kernel_code"][data-state="running"] > summary').waitFor();
    await f.page.locator(idle).waitFor();
    await unchanged("settled");
    await f.page.getByText("Settled.", { exact: true }).waitFor();
    await f.page.getByText(/^Steady layout /).waitFor();
    await f.page.getByText("Same assistant message after the call.", { exact: true }).waitFor();
    assert.equal(await f.page.locator(".pi-thinking").count(), 0);

    await f.page.locator("#open-settings").click();
    await f.page.locator("#open-visual-effects").click();
    await f.page.locator("#setting-show-thinking").press("Space");
    assert.equal(await f.page.locator("#setting-show-thinking").isChecked(), true);
    await f.page.locator("#setting-expand-thinking").press("Space");
    assert.equal(await f.page.locator("#setting-expand-thinking").isChecked(), true);
    await f.page.locator("#close-settings").click();
    await f.page.locator(".pi-thinking[open]").waitFor({ state: "attached" });

    await f.page.locator("#composer").fill("Check folds");
    await f.page.locator("#send-message").click();
    const before = f.page.getByText("Before tool, always visible.", { exact: true });
    const after = f.page.getByText("Fold final.", { exact: true });
    await after.waitFor();
    const turn = f.page.locator(".pi-message-assistant").filter({ has: after });
    const segmented = turn.locator('.pi-turn-process[data-turn-fold="segmented"][data-state="done"]');
    const tool = turn.locator('[data-tool-name="kernel_code"] > summary');
    await before.waitFor();
    await segmented.waitFor();
    await tool.waitFor({ state: "hidden" });
    await segmented.locator("summary.pi-turn-summary").click();
    await tool.waitFor();

    await f.page.locator("#open-settings").click();
    await f.page.locator('#settings-content[data-section="general"]').waitFor();
    const visualControls = "#setting-turn-fold-mode, #setting-no-animation, #setting-terminal-cursor-blink, #setting-show-message-images";
    assert.equal(await f.page.locator(visualControls).count(), 0);
    await f.page.locator("#open-visual-effects").click();
    await f.page.locator('#settings-content[data-section="visual-effects"]').waitFor();
    for (const selector of visualControls.split(", ")) await f.page.locator(selector).waitFor();
    await f.page.locator("#setting-turn-fold-mode").selectOption("whole");
    await f.page.locator("#close-settings").click();
    await turn.locator('.pi-turn-process[data-turn-fold="whole"]:not([open])').waitFor();
    await before.waitFor({ state: "hidden" });
    await after.waitFor();

    await f.page.locator("#open-settings").click();
    await f.page.locator("#open-visual-effects").click();
    await f.page.locator("#setting-turn-fold-mode").selectOption("segmented");
    await f.page.locator("#close-settings").click();
    await before.waitFor();
    await tool.waitFor();

    // Phone: the model pill's menu also holds thinking and tool mode, and each choice reaches the session.
    await f.page.setViewportSize({ width: 390, height: 844 });
    const pick = async (entry, option) => {
      await f.page.locator("#chat-model-select:not(:disabled)").click();
      if (entry) await f.page.locator(`[data-action="${entry}"]`).click();
      await f.page.locator(option).click();
    };
    await pick(null, '[data-model-option="verification/faux-alt"]');
    await until(() => f.state(id).model === "verification/faux-alt", "phone model choice");
    await pick("open-thinking-levels", '[data-thinking-option="high"]');
    await until(() => f.state(id).thinkingLevel === "high", "phone thinking choice");
    await pick("open-tool-modes", '[data-tool-mode="code"]');
    await until(() => f.state(id).toolMode === "code", "phone tool-mode choice");
    await f.page.locator('#chat-model-select[data-setting-value="verification/faux-alt"]').waitFor();
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
  await f.page.locator("#new-messages").evaluate((button) => button.click());
  await f.page.locator('#messages .pi-message-user[data-entry-id]').filter({ hasText: "Historical question 51" }).waitFor();
  const input = f.page.locator("#composer");
  await input.focus();
  await f.page.clock.pauseAt((await f.page.evaluate(() => Date.now())) + 500);
  await f.page.clock.runFor(32);
  const setupRenders = await f.page.evaluate(() => window.__messageRenders.read().reduce((sum, commit) => sum + (commit.MessageView ?? 0), 0));
  assert(setupRenders >= 5, `counter must observe setup renders, got ${setupRenders}`);
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
