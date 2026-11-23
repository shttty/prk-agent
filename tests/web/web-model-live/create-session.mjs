import assert from "node:assert/strict";

export async function createSession(ctx, page, count) {
  const button = page.locator('button[data-action="create-session"]').first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.click();
  const dialog = page.locator('#management-dialog[data-kind="create"]');
  const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/sessions") && candidate.request().method() === "POST");
  await dialog.locator("#confirm-create-session").click();
  const created = await response;
  assert.equal(created.status(), 201);
  await page.waitForFunction((expected) => document.querySelectorAll("[data-session-id]").length >= expected, count, { timeout: 30_000 });
  const names = await page.locator("[data-session-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-session-id")).filter(Boolean));
  return names.sort();
}
