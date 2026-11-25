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
  const opener = images.first().locator("..");
  await opener.click();
  const viewer = page.locator("#message-image-viewer");
  await viewer.locator('[data-image-source="kernel"]').waitFor();
  const counter = viewer.locator('[data-image-index]');
  const index = Number(await counter.getAttribute("data-image-index"));
  const total = Number(await counter.getAttribute("data-image-total"));
  if (total !== 7) {
    const tail = [];
    for (let i = index + 1; i <= total; i++) {
      await page.keyboard.press("ArrowRight");
      await viewer.locator(`[data-image-index="${i}"]`).waitFor();
      tail.push(await viewer.locator("[data-image-source]").getAttribute("title"));
    }
    assert.fail(`Expected 7, got ${total}; sources after ${index}: ${JSON.stringify(tail)}`);
  }
  assert.equal(index, 6);
  await page.keyboard.press("ArrowLeft");
  await viewer.locator('[data-image-source="tool"]').waitFor();
  await viewer.locator('[data-image-index="5"]').waitFor();
  await viewer.locator('[data-action="next-image"]').click();
  await viewer.locator('[data-image-index="6"]').waitFor();
  await viewer.locator('img[alt="执行图片 1"]').waitFor();
  assert.equal(requests.length, 2, "opening the original reuses the loaded image");
  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "detached" });
  await opener.and(page.locator(":focus")).waitFor();

  await page.locator("#open-settings").click();
  await page.locator("#open-visual-effects").click();
  await page.locator("#setting-turn-fold-mode").selectOption("whole");
  await page.locator("#close-settings").click();
  const whole = await assertFolded("whole");
  assert.equal(requests.length, 2, "changing fold mode reuses the session image data");
  await whole.evaluate((fold) => new Promise((resolve) => {
    function check() {
      if (getComputedStyle(fold, "::details-content").contentVisibility === "hidden") resolve();
      else requestAnimationFrame(check);
    }
    check();
  }));
  await images.first().scrollIntoViewIfNeeded();
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/kernel-gallery.png`, animations: "disabled" });

  await page.locator("#open-settings").click();
  await page.locator("#open-visual-effects").click();
  await page.locator('label.pi-settings-title[for="setting-show-message-images"]').click();
  await page.locator("#close-settings").click();
  await gallery.waitFor({ state: "detached" });
  await page.locator("#open-settings").click();
  await page.locator("#open-visual-effects").click();
  await page.locator('label.pi-settings-title[for="setting-show-message-images"]').click();
  await page.locator("#close-settings").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('html[data-mantine-color-scheme="dark"]').waitFor({ state: "attached" });
  await images.first().click();
  await viewer.locator('img[alt="执行图片 1"]').waitFor();
  const mobile = await viewer.boundingBox();
  assert(mobile.x >= 0 && mobile.x + mobile.width <= 390);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const stage = viewer.locator('[data-zoom="1"]');
  const frame = await stage.boundingBox();
  const x = frame.x + frame.width / 2, y = frame.y + frame.height / 2;
  const points = (spread) => [{ id: 0, x: x - spread, y }, { id: 1, x: x + spread, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(28) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(70) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await viewer.locator('[data-zoom]:not([data-zoom="1"])').waitFor();
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/lightbox-mobile-dark.png`, animations: "disabled" });
  const overlay = page.locator('.mantine-Modal-overlay');
  await overlay.click({ position: { x: 3, y: 3 } });
  await viewer.waitFor({ state: "detached" });
}
