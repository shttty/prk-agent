

export async function chooseSessionMenuItem(ctx, page, name, touch = false) {
    await ctx.openSessionMenu(page, touch);
    const item = page.locator(`#${name}`);
    if (touch) await item.tap(); else await item.click();
  }
