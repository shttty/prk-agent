import assert from "node:assert/strict";

export async function checkComposingEnter(ctx, page, sessionId, text, phase) {
    const ids = (snapshot) => [...new Set([...(snapshot.operation?.requestIds || []), ...(Array.isArray(snapshot.recentOperations) ? snapshot.recentOperations.flatMap((operation) => operation.requestIds || []) : [])])].sort();
    const before = ids(await ctx.state(page, sessionId));
    const input = page.locator("#composer");
    await input.fill(text);
    await input.evaluate((element) => element.addEventListener("keydown", (event) => { element.dataset.imeEnter = String(event.isComposing); }, { once: true }));
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.imeSetComposition", { text: "中文", selectionStart: 2, selectionEnd: 2 });
      await input.press("Enter");
      assert.equal(await input.getAttribute("data-ime-enter"), "true", `${phase}: Chromium emitted a genuine composing key event`);
      const draft = await input.inputValue();
      assert.ok(draft === `${text}中文` || draft === `${text}中文\n`, `${phase}: composed text remains intact`);
      await cdp.send("Input.insertText", { text: "中文" });
      assert.deepEqual(ids(await ctx.state(page, sessionId)), before, `${phase}: composing Enter and composition end do not admit or queue a message`);
      return { phase, composingKey: true, noAdmission: true };
    } finally { await cdp.detach(); }
  }
