import assert from "node:assert/strict";

export async function checkCopyPeekBoundary({ page, row, phone = false }) {
  const openPeek = page.locator('#capability-peek[data-open="true"]');
  const copy = row.locator(".capability-copy");
  const controls = row.locator(".capability-mode, .capability-pair");
  await row.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await openPeek.waitFor({ state: "detached" });
  if (phone) await row.locator('[data-stop="off"]').click();
  else await controls.hover();
  await page.waitForTimeout(400);
  assert.equal(await openPeek.count(), 0, "Entering the right-side switch directly never opens Peek");
  const geometry = await row.evaluate((element) => {
    const copy = element.querySelector(".capability-copy").getBoundingClientRect();
    const summary = element.querySelector(".capability-summary").getBoundingClientRect();
    const controls = element.querySelector(".capability-mode, .capability-pair").getBoundingClientRect();
    const status = element.querySelector(".tri-status");
    const statusBox = status?.getBoundingClientRect();
    const interaction = element.querySelector(".tri-track, .mantine-Switch-root").getBoundingClientRect();
    const reset = element.querySelector(".capability-override").getBoundingClientRect();
    const group = element.closest(".capability-section").querySelector(".capability-group");
    const config = group.querySelector('[data-action="open-config"]')?.getBoundingClientRect();
    const groupStatus = group.querySelector(".tri-status")?.getBoundingClientRect();
    return { copyRight: copy.right, summaryRight: summary.right, controlsLeft: controls.left,
      statusLeft: statusBox?.left, statusRight: statusBox?.right, statusOpacity: status ? Number(getComputedStyle(status).opacity) : undefined,
      interactionLeft: Math.min(interaction.left, reset.left), configRight: config?.right, groupStatusLeft: groupStatus?.left,
      configX: config ? (config.left + config.right) / 2 : undefined, configY: config ? (config.top + config.bottom) / 2 : undefined,
      gapX: (copy.right + (statusBox?.left ?? controls.left)) / 2, y: (copy.top + copy.bottom) / 2 };
  });
  assert(geometry.copyRight < geometry.controlsLeft, "The narrowed copy leaves a real blank gap before controls");
  if (geometry.statusLeft !== undefined) {
    assert(geometry.statusOpacity > 0.99, "The actual tri-state status is visible during the geometry check");
    assert(geometry.summaryRight + 4 <= geometry.statusLeft, "The visible state word sits in clean space, never over the summary");
    assert(geometry.statusRight <= geometry.interactionLeft, "The state word stays left of the switch/reset controls");
  }
  if (geometry.configRight !== undefined) {
    assert(geometry.configRight <= geometry.groupStatusLeft, "Group configuration and tri-state status never overlap");
    await page.mouse.move(geometry.configX, geometry.configY);
    await page.waitForTimeout(400);
    assert.equal(await openPeek.count(), 0, "Hovering group configuration never opens entry details");
  }
  if (phone) {
    const cdp = await page.context().newCDPSession(page);
    try {
      for (const target of [await controls.boundingBox(), { x: geometry.gapX, y: geometry.y, width: 0, height: 0 }]) {
        assert(target);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
        await page.waitForTimeout(500);
        assert.equal(await openPeek.count(), 0, "Long-pressing right controls or the blank gap never opens details");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      }
      const left = await copy.boundingBox();
      assert(left);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: left.x + left.width / 2, y: left.y + left.height / 2 }] });
      await page.locator('#capability-peek[data-open="true"][data-mode="touch"]').waitFor();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await openPeek.waitFor({ state: "detached" });
      await page.waitForTimeout(400);
    } finally { await cdp.detach(); }
    return;
  }
  for (const selector of [".capability-override", ".prk-tri-switch", ".mantine-Switch-root"].filter((selector) => selector !== ".prk-tri-switch" || geometry.statusLeft !== undefined)) {
    const target = row.locator(selector);
    if (!await target.count()) continue;
    await page.mouse.move(1, 1);
    await target.hover();
    await page.waitForTimeout(400);
    assert.equal(await openPeek.count(), 0, `${selector} does not start a detail timer`);
  }
  await page.mouse.move(geometry.gapX, geometry.y);
  await page.waitForTimeout(400);
  assert.equal(await openPeek.count(), 0, "The blank gap is outside the detail-hover target");
  await copy.hover();
  await page.waitForTimeout(100);
  await controls.hover();
  await page.waitForTimeout(400);
  assert.equal(await openPeek.count(), 0, "Copy-to-controls movement cancels the pending hover timer");
  await copy.hover();
  await openPeek.waitFor();
  await controls.hover();
  await openPeek.waitFor({ state: "detached" });
  await copy.hover();
  await openPeek.waitFor();
  await page.mouse.move(1, 1);
  await openPeek.waitFor({ state: "detached" });
}
