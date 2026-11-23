import assert from "node:assert/strict";

/**
 * Verify durable presentation state against the actual desktop and phone pages.
 * Session selection and connection helpers are injected from the real fixture.
 */
export async function verifySessionPresentationPersistence({ page, phone, names, selectSession, selectSessionOn, connected, connectedOn }) {
  await selectSession("first");
  const card = page.locator("[data-tool-key]").filter({ hasText: "ux-line-000-" }).first();
  const output = card.locator(".output-block");
  for (const disclosure of await output.locator("xpath=ancestor::details").all()) {
    if (!await disclosure.evaluate((node) => node.open)) await disclosure.locator(":scope > summary").click();
  }
  await output.waitFor({ state: "visible" });
  const hiddenOf = (target) => target.locator('[data-action="expand-lines"]').first().getAttribute("data-hidden-lines");
  const hidden = await hiddenOf(card);
  assert(Number(hidden) > 0, "Long tool output is folded");
  await selectSession("second"); await selectSession("first");
  assert.equal(await hiddenOf(card), hidden, "Folded tool output follows its session");
  await page.reload(); await connected(names.get("first"));
  const refreshedCard = page.locator("[data-tool-key]").filter({ hasText: "ux-line-000-" }).first();
  assert(await refreshedCard.evaluate((node) => node.open), "Tool disclosure remains expanded after refresh");
  assert.equal(await hiddenOf(refreshedCard), hidden, "Folded tool output survives refresh");
  await selectSessionOn(phone, "first");
  await phone.reload(); await connectedOn(phone, names.get("first"));
}
