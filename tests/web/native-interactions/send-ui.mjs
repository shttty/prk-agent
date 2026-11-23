import assert from "node:assert/strict";

export async function sendUi(ctx, page, text, touch = false) {
    await page.locator("#composer").fill(text);
    const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/send"));
    const send = page.locator("#send-message");
    if (touch) await send.tap(); else await send.click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, `UI send ${text}`);
    return ctx.readJsonResponse(response);
  }
