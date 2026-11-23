// Chat about this, cancel, stopping the turn, reload and switching sessions (desktop).
// One single-select question: no review tab, the page's own button submits (choosing alone never does). A single
  // multi-select question and several questions keep the review tab.
// Timeout: the card counts down, then the Gateway answers every question with its recommended (else first) option.
import assert from "node:assert/strict";

export async function checkAskAnswersAndTimeouts(ctx) {
{
    const { context, page, problems, select } = await ctx.open(ctx.main, { width: 1440, height: 900 }, "light");
    await ctx.ask(page, ctx.QUESTIONS);
    await page.locator('[data-action="ask-chat"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.match(ctx.text(await ctx.main.toolResult()), /^User chose to chat about this instead of answering\./);

    // 取消 stops the turn the way the composer's stop button does: the dialog closes, the model is not called again, the
    // session takes the next message, and the ask call's history row reads as cancelled.
    await ctx.ask(page, ctx.QUESTIONS);
    const calls = ctx.contexts.length;
    await page.locator('[data-action="ask-cancel"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    await ctx.until(() => ctx.main.host.state(ctx.main.main).state, (state) => state === "idle", "idle after cancel");
    await ctx.sleep(300);
    assert.equal(ctx.contexts.length, calls, "cancel stops the turn: the model is not called again");
    assert.deepEqual(ctx.main.host.state(ctx.main.main).messages.findLast((message) => message.toolName === "ask")?.details, { outcome: "cancelled" });
    const cancelledAsk = page.locator('.pi-tool[data-tool-name="ask"]').last();
    const cancelledTurn = cancelledAsk.locator('xpath=ancestor::details[contains(@class,"pi-turn-process")]');
    if (!await cancelledTurn.evaluate((node) => node.open)) await cancelledTurn.locator(":scope > summary").click();
    if (!await cancelledAsk.evaluate((node) => node.open)) await cancelledAsk.locator(":scope > summary").click();
    if (await cancelledAsk.getAttribute("data-content-state") === "preview") {
      await cancelledAsk.locator('[data-action="expand-lines"][data-total-bytes]').first().click();
    }
    await page.locator('[data-kind="ask-cancelled"]').waitFor({ state: "attached" });
    assert.equal(await page.locator('[data-kind="ask-cancelled"]').count(), 1, "the history row of the cancelled ask reads as cancelled");
    await ctx.shot(page, "cancelled-history-loaded");
    assert.equal(await page.locator("#composer").isDisabled(), false, "the composer takes input again");
    await page.locator("#composer").fill("hello after cancel");
    await page.locator("#send-message").click();
    await ctx.until(() => ctx.contexts.length, (count) => count === calls + 1, "the next message reaches the model");
    await ctx.until(() => ctx.main.host.state(ctx.main.main).state, (state) => state === "idle", "reply finished");

    await ctx.ask(page, ctx.QUESTIONS);
    await page.locator("#cancel-operation").click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.equal(ctx.main.prompts().length, 0, "stopping the turn closes the dialog at the Gateway");

    // A draft survives switching to another session and back (this page), not a reload; the dialog itself survives both.
    await ctx.ask(page, ctx.QUESTIONS);
    await page.locator('[data-ask-option="2"]').click();
    await select(ctx.main.other);
    assert.equal(await page.locator(".pi-ask").count(), 0, "another session shows no ask card");
    await select(ctx.main.main);
    await page.locator(".pi-ask").waitFor();
    assert.equal(await ctx.attr(page, '[data-ask-option="2"]', "data-selected"), "true", "the draft survived the session switch");
    await page.reload();
    await select(ctx.main.main);
    await page.locator(".pi-ask").waitFor();
    assert.equal(ctx.main.prompts().length, 1, "the dialog is the Gateway's: it is still waiting after a reload");
    assert.equal(await ctx.attr(page, '[data-ask-option="2"]', "data-selected"), "false", "an unsubmitted draft does not survive a reload");
    await page.locator('[data-action="ask-cancel"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.deepEqual(problems, [], "page errors");
    await context.close();
    console.log("PASS chat about this, cancel, stop, session switch and reload");
  }

for (const [label, viewport, scheme] of [["desktop-light", { width: 1440, height: 900 }, "light"], ["phone-light", { width: 390, height: 844 }, "light"]]) {
    const { context, page, problems } = await ctx.open(ctx.main, viewport, scheme);
    await ctx.ask(page, [ctx.QUESTIONS[0]]);
    assert.equal(await page.locator("[data-ask-tab-button]").count(), 0, `${label}: no tabs and no review tab`);
    assert.equal(await page.locator('[data-action="ask-next"]').count(), 0, `${label}: nothing to step to`);
    assert.equal(await page.locator('[data-action="ask-submit"]').isDisabled(), true, `${label}: nothing to submit before an answer`);
    await page.locator('[data-ask-option="1"]').click();
    assert.equal(await page.locator('[data-action="ask-submit"]').isDisabled(), false);
    await ctx.sleep(300);
    assert.equal(ctx.main.prompts().length, 1, `${label}: choosing an option does not submit`);
    await page.locator('[data-ask-preview="1"] pre code').waitFor();
    await ctx.themeShots(page, `ask-single-${label}`);
    await page.locator('[data-action="ask-submit"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.equal(ctx.text(await ctx.main.toolResult()), "User answers:\nstorage: Postgres", `${label}: the model sees the answer`);
    if (label === "desktop-light") {
      await ctx.ask(page, [ctx.QUESTIONS[1]]);
      assert.deepEqual(await page.locator("[data-ask-tab-button]").evaluateAll((nodes) => nodes.map((node) => node.dataset.askTabButton)), ["0", "review"], "a single multi-select question keeps its review tab");
      await page.locator('[data-action="ask-chat"]').click();
      await page.locator(".pi-ask").waitFor({ state: "detached" });
    }
    assert.deepEqual(problems, [], `${label}: page errors`);
    await context.close();
    for (const scheme of ["light", "dark"]) console.log(`PASS ${label.replace("-light", `-${scheme}`)}: one single-select question submits from its own page (shared device turn)`);
  }

{
    const quick = await ctx.stack({ askTimeoutMs: 3000 });
    const { context, page, problems } = await ctx.open(quick, { width: 1440, height: 900 }, "light");
    await ctx.ask(page, ctx.QUESTIONS);
    const deadline = Number(await ctx.attr(page, "[data-expires-at]", "data-expires-at"));
    assert.ok(deadline > Date.now() && deadline <= Date.now() + 3000, "the countdown shows the Gateway deadline");
    await ctx.shot(page, "ask-desktop-light-countdown");
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.equal(ctx.text(await quick.toolResult()), "User answers:\nstorage: Postgres (auto-selected after timeout)\nfeatures: [Search] (auto-selected after timeout)\nrollout: Staged (auto-selected after timeout)");
    assert.deepEqual(problems, [], "page errors");
    await context.close();
    console.log("PASS timeout: countdown on the card, recommended options auto-selected");
  }

console.log("PASS ask UI");
}
