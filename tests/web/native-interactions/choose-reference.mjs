

export async function chooseReference(ctx, page, text, touch = false) {
    const option = page.getByRole("option").filter({ hasText: text }).first();
    await option.waitFor({ state: "visible" });
    if (touch) await option.tap(); else await option.click();
  }
