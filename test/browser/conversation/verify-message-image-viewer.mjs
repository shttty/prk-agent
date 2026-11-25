import assert from "node:assert/strict";

export async function verifyMessageImageViewer(page, attachment) {
  await page.locator('html[data-mantine-color-scheme="light"]').waitFor({ state: "attached" });
  const opener = attachment.locator("..");
  const dialog = page.locator('#message-image-viewer');
  await opener.click();
  await dialog.locator('[data-image-index="1"][data-image-total="3"]').waitFor();
  await dialog.locator('[data-image-source="attachment"]').waitFor();
  await page.keyboard.press("ArrowRight");
  await dialog.locator('[data-image-index="2"][data-image-total="3"]').waitFor();
  await dialog.locator('[data-image-source="markdown"]').waitFor();
  const stage = dialog.locator('[data-zoom="1"]');
  const picture = dialog.locator('img[alt="Target chart"]');
  await picture.waitFor();
  const [popup] = await Promise.all([page.waitForEvent("popup"), dialog.locator('[data-action="open-original-image"]').click()]);
  await popup.waitForFunction(() => document.querySelector("img")?.naturalWidth === 400);
  await popup.close();
  await stage.hover();
  await page.mouse.wheel(0, -380);
  await dialog.locator('[data-zoom]:not([data-zoom="1"])').waitFor();
  const bounds = await picture.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 20);
  await page.mouse.up();
  assert.match(await picture.getAttribute("style"), /translate\(30px, 20px\)/);
  await picture.dblclick();
  await stage.waitFor();
  if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/lightbox-desktop.png`, animations: "disabled" });

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await opener.and(page.locator(":focus")).waitFor();
  const markdownOpener = page.locator('#messages .pi-message-assistant img[alt="Target chart"]').locator("..");
  await markdownOpener.click();
  await dialog.locator('[data-image-index="2"][data-image-total="3"]').waitFor();
  await page.keyboard.press("Escape");
  await markdownOpener.and(page.locator(":focus")).waitFor();
}
