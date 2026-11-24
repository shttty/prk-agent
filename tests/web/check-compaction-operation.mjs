import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { openSession, withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

const deadline = 1000;
await withRequestWorkbench(async ({ root, host, client, ui, page, provider, session, createSession, requests }) => {
  await prepareGatewayEnvironment(host, root, "fixture");
  const sessionId = await createSession("Compaction operation");
  const alternate = await createSession("Alternate");
  const hostSession = host.session(sessionId);
  const seed = async (count) => {
    provider.setResponses(Array.from({ length: count }, () => fauxAssistantMessage("Previous response.")));
    for (let i = 0; i < count; i++) {
      const turn = await hostSession.submit({ requestId: crypto.randomUUID(), message: `Part ${i}: ${"historic context segment ".repeat(200)}` });
      assert(turn.accepted);
      assert.equal((await turn.completion).status, "completed");
    }
  };
  await seed(3);
  const before = host.state(sessionId).contextUsage.tokens;
  assert(before > 2000, `test requires a nontrivial history, found ${before}`);
  await openSession(page, ui.url, sessionId);
  const released = Promise.withResolvers();
  const summarizing = Promise.withResolvers();
  const instruction = "Keep the database migration decision.";
  provider.setResponses([async (context) => {
    summarizing.resolve(context);
    await released.promise;
    return fauxAssistantMessage("Compact summary for the migration.");
  }]);
  const frames = [];
  const sub = hostSession.subscribe((event) => frames.push(event));
  try {
    const mark = requests.mark();
    await page.locator("#composer").fill(`/compact ${instruction}`);
    const response = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `${session(sessionId)}/send`);
    await page.locator("#send-message").click();
    const receipt = await (await response).json();
    assert.equal(receipt.accepted, true, JSON.stringify(receipt));
    assert(JSON.stringify(await summarizing.promise).includes(instruction), "Pi receives the free-text summarization instruction");
    await page.locator('#operation-state[data-stage="compacting"]').waitFor();
    const row = page.locator(`[data-session-id="${sessionId}"] [data-state="compacting"]`);
    await row.waitFor();
    assert.equal(await page.locator("#composer").inputValue(), "");
    const rejected = await client.request("send", { sessionId, requestId: "not-queued", mode: "plain", message: "Wait for compaction", queue: "followUp" });
    assert.equal(rejected.accepted, false);
    await openSession(page, null, alternate);
    await row.waitFor();
    await openSession(page, null, sessionId);
    await page.locator('#operation-state[data-stage="compacting"]').waitFor();
    await delay(deadline + 100);
    assert.equal(hostSession.state, "running", "compaction outlives the real control RPC deadline");
    assert.equal(await page.locator('#operation-state[data-stage="compacting"]').isVisible(), true);
    assert.equal(frames.some((event) => event.type === "operation_completed" && event.operationId === receipt.operationId), false);
    released.resolve();
    const marker = page.locator(".pi-history-compaction[data-entry-id]");
    await marker.waitFor();
    const saved = frames.find((event) => event.type === "operation_completed" && event.operationId === receipt.operationId);
    assert.equal(saved?.details.status, "completed");
    const pushed = frames.find((event) => event.type === "snapshot" && event.sequence === saved.sequence).details.snapshot;
    assert.equal(pushed.historyThrough, await marker.getAttribute("data-entry-id"));
    assert.equal(Object.hasOwn(pushed, "messages"), false);
    assert.equal(requests.since(mark, "GET", `${session(sessionId)}/history-page`), 1);
    await page.locator('#composer-form:not([data-busy])').waitFor();
    assert.equal(host.state(sessionId).contextUsage.tokens, null, "Pi intentionally has no new measured usage until the next model response");
    await page.locator('#context-usage[data-tone="unknown"]').waitFor();
    assert.equal(await page.locator('#context-usage .pi-context-fill').count(), 0, "the previous percentage must disappear");
    provider.setResponses([fauxAssistantMessage("After the summary.")]);
    const next = await hostSession.submit({ requestId: "measure-after", message: "Proceed." });
    assert.equal((await next.completion).status, "completed");
    await page.locator('#context-usage:not([data-tone="unknown"]) .pi-context-fill').waitFor();
    const after = host.state(sessionId).contextUsage.tokens;
    assert(after < before, `measured SDK context after compaction: ${before} -> ${after}`);

    await seed(2);
    provider.setResponses([fauxAssistantMessage([], { stopReason: "error", errorMessage: "controlled summary failure" })]);
    const failed = await client.request("nativeAction", { sessionId, requestId: "failed-summary", action: "compact", args: {} });
    assert.equal(failed.status, "running");
    const error = page.locator('.pi-operation-outcome[data-status="failed"]');
    await error.waitFor();
    assert.match(await error.textContent(), /controlled summary failure/);
    assert.equal(await marker.count(), 1, "failed runs do not add a compaction marker");

    const entered = Promise.withResolvers();
    provider.setResponses([async (_context, { signal }) => {
      entered.resolve();
      if (!signal.aborted) await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      return fauxAssistantMessage("Cancellation must not save this summary.");
    }]);
    const running = await client.request("nativeAction", { sessionId, requestId: "cancel-summary", action: "compact", args: {} });
    assert.equal(running.status, "running");
    await entered.promise;
    await page.locator('#operation-state[data-stage="compacting"]').waitFor();
    await page.locator("#cancel-operation").click();
    await page.locator('.pi-operation-outcome[data-status="cancelled"]').waitFor();
    assert.equal(await marker.count(), 1);
    console.log(`PASS: /compact outlived ${deadline} ms control RPC; SSE, anchored history, failure and Stop; measured tokens ${before} -> ${after}`);
  } finally {
    released.resolve();
    sub.unsubscribe();
  }
}, { requestTimeoutMs: deadline, settings: { cacheWarming: "off", compaction: { enabled: false, keepRecentTokens: 32 }, retry: { enabled: false } } });
