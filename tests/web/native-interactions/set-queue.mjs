

export async function setQueue(ctx, page, label, touch = false) {
    // The busy-send default is a session setting in 会话详情 (opened from the selected row's menu).
    await ctx.chooseSessionMenuItem(page, "session-details", touch);
    const select = page.locator("#queue-select");
    if (touch) await select.tap(); else await select.click();
    const option = page.locator(`[role="option"][value=${JSON.stringify(label)}]`);
    if (touch) await option.tap(); else await option.click();
    const close = page.locator("#close-session-details");
    if (touch) await close.tap(); else await close.click();
    await close.waitFor({ state: "detached" });
    await page.waitForFunction((expected) => document.querySelector("#composer")?.getAttribute("data-queue") === expected, label);
  }
