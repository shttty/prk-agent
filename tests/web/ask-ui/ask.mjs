/** Ask `questions` through the composer, the way a user starts a turn. */


export async function ask(ctx, page, questions) {
    await page.locator("#composer").fill(`ASK ${JSON.stringify({ questions })}`);
    await page.locator("#send-message").click();
    await page.locator(".pi-ask").waitFor();
  }
