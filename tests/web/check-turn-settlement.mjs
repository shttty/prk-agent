import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { openSession, withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ root, host, ui, page, provider, session, createSession }) => {
  await prepareGatewayEnvironment(host, root, "fixture");
  for (const count of [1, 180]) {
    const sessionId = await createSession(`Settlement ${count}`);
    const worker = host.session(sessionId);
    provider.setResponses(Array.from({ length: count }, (_, i) => fauxAssistantMessage(`Previous reply ${i}`)));
    for (let i = 0; i < count; i++) {
      const seed = await worker.submit({ requestId: `seed-${i}`, message: `Previous prompt ${i}` });
      assert.equal((await seed.completion).status, "completed");
    }
    await openSession(page, count === 1 ? ui.url : null, sessionId);
    await page.waitForFunction(() => document.querySelector('[data-action="fork-message"]:not(:disabled)'));
    if (count > 1) {
      const older = page.locator('#history-pagination [data-action="load-history"]');
      while (await older.count()) {
        const before = await page.locator('.pi-message-user[data-entry-id]').count();
        await older.click();
        await page.waitForFunction((previous) => document.querySelectorAll('.pi-message-user[data-entry-id]').length > previous, before);
      }
      assert.equal(await page.locator('.pi-message-user[data-entry-id]').count(), count);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: count > 1 ? 4 : 1 });
    const oldFork = page.locator('[data-action="fork-message"]').first();
    const oldRetry = page.locator('[data-action="retry-message"]').first();
    const save = Promise.withResolvers();
    const requested = Promise.withResolvers();
    const url = `**${session(sessionId)}/history-page?through=*`;
    await page.route(url, async (route) => {
      requested.resolve(true);
      await save.promise;
      await route.continue();
    });
    const reply = Promise.withResolvers();
    provider.setResponses([async () => { await reply.promise; return fauxAssistantMessage("The final reply."); }]);
    const settled = Promise.withResolvers();
    const sub = worker.subscribe((event) => {
      if (event.type === "operation_completed") settled.resolve(Date.parse(event.timestamp));
    });
    try {
      const submission = await worker.submit({ requestId: "final", message: "The final prompt." });
      assert(submission.accepted);
      await page.locator('#composer-form[data-busy="true"]').waitFor();
      assert(await oldFork.isDisabled());
      assert(await oldRetry.isDisabled());
      reply.resolve();
      const settledAt = await settled.promise;
      const result = await page.waitForFunction(() => {
        const fork = Array.from(document.querySelectorAll('[data-action="fork-message"]'));
        const retry = document.querySelector('[data-action="retry-message"]');
        if (document.querySelector('#composer-form').dataset.busy || fork[0]?.disabled !== false || retry?.disabled !== false) return false;
        return { time: Date.now(), newestForkEnabled: fork.at(-1)?.disabled === false };
      }, undefined, { timeout: 20000 }).then((handle) => handle.jsonValue());
      // Hold the page reply until the operation controls are unlocked. Only the newest preview may still lack its ID.
      const pulled = await Promise.race([requested.promise, new Promise((resolve) => setTimeout(resolve, 750, false))]);
      const newestFork = page.locator('[data-action="fork-message"]').last();
      if (pulled) assert(await newestFork.isDisabled());
      save.resolve();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-action="fork-message"]')].at(-1)?.disabled === false);
      console.log(JSON.stringify({ messagesBefore: count * 2, cpuThrottle: count > 1 ? 4 : 1, oldActionsMs: result.time - settledAt, finalForkMs: result.newestForkEnabled ? result.time - settledAt : Date.now() - settledAt, historyPullHeld: pulled }));
    } finally {
      save.resolve();
      reply.resolve();
      sub.unsubscribe();
      await cdp.detach();
      await page.unroute(url);
    }
  }
});
