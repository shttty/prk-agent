

export async function open(ctx, stackEntry, viewport, colorScheme) {
    const phone = ctx.isPhone(viewport);
    const context = await ctx.browser.newContext({ viewport, colorScheme, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    await page.goto(stackEntry.ui.url);
    const select = async (name) => {
      if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
      await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
      await page.locator(`.management-session-row[data-session-id="${name}"][aria-current="true"]`).waitFor();
      await page.locator("#history-loading").waitFor({ state: "hidden" });
      await page.locator("#composer").waitFor();
    };
    await select(stackEntry.main);
    return { context, page, problems, select };
  }
