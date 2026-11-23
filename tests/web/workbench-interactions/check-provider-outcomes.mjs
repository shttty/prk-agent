// The browser never offers an unlisted kernelspec; a forged choice is rejected without fallback.
// --------------------------------------------- Gateway unavailability, last
  // Shutting the Gateway down ends its sessions, so this is the final step.
// Starting a fresh adapter against the dead socket must fail, not substitute.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { startWebApplication } from "../../../src/http/application/start-application.ts";

export async function checkProviderOutcomes(ctx) {
assert.equal(ctx.providerFailure.status, "failed", "A provider failure is recorded as a failed operation");

assert.match(ctx.providerFailure.error, /WebSocket error/, "The Web retains the provider failure cause");

assert(!ctx.providerFailure.error.includes("fixtureTransport"), "The Web error omits the diagnostic stack");

const providerStatus = ctx.page.locator("#messages .pi-operation-outcome.is-error").filter({ hasText: /WebSocket error/ }).last();

await providerStatus.waitFor({ state: "visible" });

await providerStatus.scrollIntoViewIfNeeded();

await ctx.noOverflow(ctx.page);

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-provider-failure-summary.png"), fullPage: true, animations: "disabled" });

const sessionsBeforeInvalidKernel = ctx.host.workbench().sessions.map(({ sessionId }) => sessionId);

const invalidKernel = await ctx.request("/api/sessions", { target: "alpha", kernelName: "missing-kernel" });

assert.equal(invalidKernel.status, 400);

assert.deepEqual(ctx.host.workbench().sessions.map(({ sessionId }) => sessionId), sessionsBeforeInvalidKernel, "The removed kernelName field is rejected and creates no fallback worker");

assert.deepEqual(ctx.errors, [], "No browser runtime errors");

const browserSecurity = await ctx.page.evaluate(() => ({ isSecureContext, clipboardExposed: Boolean(navigator.clipboard) }));

await ctx.browser.close();

ctx.browser = undefined;

ctx.page = undefined;

ctx.phone = undefined;

assert.equal((await ctx.sessionKernels("session-two")).length, 1, "The second session's REPL is live before shutdown");

await ctx.endpoint.close();

await ctx.endpoint.closed;

ctx.endpoint = undefined;

ctx.host = undefined;

await ctx.wait(async () => JSON.stringify(await ctx.ids()) === JSON.stringify(ctx.sentinelIds), "Gateway shutdown releases exactly its own kernels");

const unavailableCases = [];

for (const [path, body] of [["/api/workbench", undefined], ["/api/sessions", { target: "alpha" }]]) {
    const response = await ctx.request(path, body);
    const payload = await response.text();
    unavailableCases.push({ path, status: response.status, error: JSON.parse(payload).error });
    assert.equal(response.status, 503, `${path} reports Gateway unavailability`);
    assert(typeof JSON.parse(payload).error === "string" && JSON.parse(payload).error.length > 0, `${path} returns an explicit error`);
  }

assert.deepEqual(await ctx.ids(), ctx.sentinelIds, "A request to an unavailable Gateway creates no kernel");

await assert.rejects(
    startWebApplication({ socket: ctx.socket, port: 0 }),
    (error) => error instanceof Error && ["ENOENT", "PRIVATE_ENDPOINT", "CLIENT_ERROR"].includes(error.code),
    "startWebApplication against a dead Gateway must reject on the missing endpoint, never start a listener or a local host",
  );

assert.deepEqual(await ctx.ids(), ctx.sentinelIds, "A refused web startup creates no kernel");

await ctx.stopWebProcess(ctx.webProcess);

ctx.webProcess = undefined;

assert.match(ctx.text(await ctx.sentinel.tool.execute("sentinel-after", { code: "print(sentinel_value)" }, ctx.signal)), /73/, "Gateway shutdown leaves the unrelated kernel and the Jupyter Server running");

await ctx.sentinel.close();

await ctx.wait(async () => JSON.stringify(await ctx.ids()) === JSON.stringify(ctx.baseline), "all owned kernels released back to the recorded baseline");

await writeFile(join(ctx.evidence, "ownership-evidence.json"), JSON.stringify({
    webHost: ctx.webHost, webOrigins: ctx.webOrigins, browserSecurity, gatewaySocket: ctx.socket,
    beforeWebRestart: ctx.before, afterWebRestart: ctx.after,
    kernelsBeforeRestart: ctx.kernelsBeforeRestart, kernelsAfterRestart: ctx.kernelsAfterRestart,
    gatewayUnavailable: unavailableCases,
    baseline: ctx.baseline, sentinelIds: ctx.sentinelIds,
  }, null, 2));

console.log(`PASS controlled-provider browser -> web adapter -> Gateway/SDK/Jupyter: real streamed Python and assistant replies, two sessions on one environment isolated at 41/99 with distinct sessionIds and kernels, a web-only restart preserving routing identity/sessionId/kernel id and both Python values, Gateway unavailability that creates nothing and refuses to start a substitute host, per-session close isolation with a surviving sibling and sentinel, sanitized Markdown with literal tool output, desktop+mobile without overflow and no page errors. Evidence: ${ctx.evidence}`);
}
