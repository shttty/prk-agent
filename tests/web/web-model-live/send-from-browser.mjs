import assert from "node:assert/strict";

export async function sendFromBrowser(ctx, page, sessionId, expectedValue, phase) {
  assert(ctx.evidence.submissionAttempts.length < ctx.MAX_SUBMISSIONS, "Submission budget exceeded; no retry is permitted.");
  await ctx.selectSession(page, sessionId);
  const before = await ctx.snapshotFor(page, sessionId);
  const priorToolCallIds = new Set((before.messages ?? [])
    .filter((message) => message.role === "toolResult" && message.toolName === "kernel_code")
    .map((message) => message.toolCallId ?? message.id)
    .filter(Boolean));
  const isSeed = phase === "seed";
  const marker = isSeed ? "LIVE_VALUE" : "LIVE_READ";
  const prompt = ctx.controlled
    ? (isSeed ? `live_value = ${expectedValue}\nprint("${marker}", live_value)` : `print("${marker}", live_value)`)
    : isSeed
    ? `Use the kernel_code tool exactly once. Run exactly this Python code and do not retry.\n\nlive_value = ${expectedValue}\nprint("${marker}", live_value)\n\nDo not use another tool. Only report after the kernel_code tool returns.`
    : `Use the kernel_code tool exactly once to read the existing variable live_value. Run exactly this Python code:\n\nprint("${marker}", live_value)\n\nDo not assign or initialize live_value, do not use another tool, and do not retry.`;
  let request;
  const onRequest = (candidate) => {
    if (candidate.method() !== "POST" || !candidate.url().includes(`/api/sessions/${encodeURIComponent(sessionId)}/send`)) return;
    try {
      request = candidate.postDataJSON();
    } catch {
      throw new Error("Browser send request was not JSON.");
    }
  };
  page.on("request", onRequest);
  const startedAt = Date.now();
  try {
    await page.locator("#composer").fill(prompt);
    await page.locator("#send-message").click();
    await ctx.waitFor(() => request !== undefined, "browser send HTTP request", 30_000);
  } finally {
    page.off("request", onRequest);
  }
  assert.equal(typeof request.requestId, "string", "Browser send must carry one request ID.");
  ctx.evidence.submissionAttempts = [...ctx.evidence.submissionAttempts, { phase, sessionId, requestId: request.requestId, status: "submitted; terminal not yet established" }];
  const deadline = startedAt + ctx.SUBMISSION_TIMEOUT_MS;
  let state;
  let completion;
  while (Date.now() < deadline) {
    state = await ctx.snapshotFor(page, sessionId);
    completion = state.recentOperations?.find((operation) => operation.requestIds?.includes(request.requestId));
    if (completion) break;
    await ctx.sleep(500);
  }
  assert(completion, `Timed out waiting for terminal operation in ${phase} for ${sessionId}.`);
  const durationMs = Date.now() - startedAt;
  assert(durationMs <= ctx.SUBMISSION_TIMEOUT_MS, `Submission exceeded ${ctx.SUBMISSION_TIMEOUT_MS}ms.`);
  ctx.evidence.submissionAttempts = ctx.evidence.submissionAttempts.map((attempt) => attempt.requestId === request.requestId ? { ...attempt, status: completion.status, operationId: completion.operationId } : attempt);
  assert.equal(completion.status, "completed", `Model operation ${completion.operationId} did not complete; no replay is permitted.`);
  const result = ctx.lastPythonResult(state);
  const resultToolCallId = result?.toolCallId ?? result?.id;
  assert(result && resultToolCallId && !priorToolCallIds.has(resultToolCallId), "The completed submission must produce a new Python tool result, not reuse a prior result.");
  const extracted = ctx.extractedResult(result, expectedValue, marker);
  const browserOutput = await page.locator(".output-block").allTextContents();
  if (phase === "gateway") {
    // After a Gateway loss nothing is adopted or replayed: the new runtime has no live_value.
    assert.equal(extracted.containsExpected, false, `A recovered runtime must not still hold ${marker} ${expectedValue}.`);
    assert(browserOutput.some((text) => text.includes("NameError") && text.includes("live_value")), "Browser did not render the empty-namespace NameError.");
  } else {
    assert.equal(extracted.containsExpected, true, `Python result did not contain ${marker} ${expectedValue}.`);
    assert(browserOutput.some((text) => text.includes(marker) && text.includes(String(expectedValue))), "Browser did not render the Python result.");
  }
  const record = {
    phase,
    requestId: request.requestId,
    operationId: completion.operationId,
    status: completion.status,
    sessionId: state.sessionId,
    kernelId: state.kernel?.kernelId,
    durationMs,
    result: extracted,
    browserRendered: true,
  };
  ctx.evidence.submissions = [...ctx.evidence.submissions, record];
  return { state, record };
}
