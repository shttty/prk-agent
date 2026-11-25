import assert from "node:assert/strict";

export async function verifyFoldedKernelImages(f, id) {
  const { page } = f;
  const requests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/kernel/result") && url.searchParams.has("imageIndex")) requests.push(url.href);
  });
  const code = "from pathlib import Path\nclass Chart:\n    def _repr_png_(self):\n        return Path('reply chart.png').read_bytes()\ndisplay(Chart())\nChart()";
  const foreground = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
  assert.equal((await f.complete(id, foreground)).status, "completed");
  await page.locator('[data-kind="kernel-image-gallery"]:not([data-cell-id]) img').nth(1).waitFor();
  assert.equal(requests.length, 0, "foreground images use the versioned tool content path");
  const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code: `import asyncio\nawait asyncio.sleep(.15)\n${code}`, yield_s: 0 } })}`);
  assert.equal((await f.complete(id, receipt)).status, "completed");
  await page.locator('#composer-form:not([data-busy])').waitFor();

  const gallery = page.locator('[data-kind="kernel-image-gallery"][data-cell-id]');
  const images = gallery.locator('img');
  const assertFolded = async (mode) => {
    const fold = page.locator(`details[data-turn-fold="${mode}"]:has(+ [data-kind="kernel-image-gallery"][data-cell-id])`);
    await fold.waitFor();
    if (await fold.evaluate((node) => node.open)) await fold.locator(":scope > summary").click();
    assert.equal(await fold.getAttribute("open"), null);
    await images.nth(1).waitFor();
    assert.equal(await images.count(), 2);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-kind="kernel-image-gallery"][data-cell-id] img')].every((img) => img.naturalWidth > 0));
    return fold;
  };

  const segment = await assertFolded("segmented");
  assert.equal(requests.length, 2, "one transfer per image");
  await segment.locator(":scope > summary").click();
  const tool = segment.locator('[data-kind="kernel-cell"]');
  await tool.locator(":scope > summary").click();
  await tool.locator('[data-kind="kernel-images"][data-count="2"]').waitFor();
  await images.nth(1).waitFor();
  assert.equal(requests.length, 2, "opening the tool preserves the loaded gallery");
  await images.first().click();
  await page.locator('[role="dialog"] img').waitFor();
  await page.keyboard.press("Escape");
  await page.locator('[role="dialog"] img').waitFor({ state: "detached" });
  assert.equal(requests.length, 2, "opening the original reuses the loaded image");

  await page.locator("#open-settings").click();
  await page.locator("#open-visual-effects").click();
  await page.locator("#setting-turn-fold-mode").selectOption("whole");
  await page.locator("#close-settings").click();
  await assertFolded("whole");
  assert.equal(requests.length, 2, "changing fold mode reuses the session image data");
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/kernel-gallery.png`, animations: "disabled" });

  await page.locator("#open-settings").click();
  await page.locator("#open-visual-effects").click();
  await page.locator('label.pi-settings-title[for="setting-show-message-images"]').click();
  await page.locator("#close-settings").click();
  await gallery.waitFor({ state: "detached" });
}
