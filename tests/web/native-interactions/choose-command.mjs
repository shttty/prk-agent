import assert from "node:assert/strict";

export async function chooseCommand(ctx, page, name, touch = false) {
    await page.locator("#composer").fill(`/${name}`);
    const option = page.getByRole("option", { name: new RegExp(`^/${name}(?:\\s|$)`) }).first();
    await option.waitFor({ state: "visible" });
    if (touch) await option.tap(); else await option.click();
    assert.match(await page.locator("#composer").inputValue(), new RegExp(`^/${name}\\s+$`), `${name} selection does not send`);
  }
