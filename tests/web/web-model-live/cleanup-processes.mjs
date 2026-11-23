import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";

export async function cleanupProcesses(ctx) {
  const errors = [];
  if (ctx.web) {
    try { await ctx.stopProcess(ctx.web); } catch (error) { errors.push(ctx.sanitizeError(error)); }
    ctx.evidence.cleanup.web = ctx.safeProcessRecord(ctx.web);
    ctx.web = undefined;
  }
  if (ctx.ui) {
    try { await ctx.ui.close(); } catch (error) { errors.push(ctx.sanitizeError(error)); }
    ctx.ui = undefined;
  }
  if (ctx.browser) {
    try { await ctx.browser.close(); } catch (error) { errors.push(ctx.sanitizeError(error)); }
    ctx.browser = undefined;
  }
  if (ctx.gateway) {
    try {
      if (ctx.gateway.child.exitCode === null && ctx.gateway.child.signalCode === null && ctx.socket && await ctx.exists(ctx.socket)) {
        const client = await ctx.bounded(ctx.connectGateway(ctx.socket), "Gateway cleanup attach", 20_000);
        try { await ctx.bounded(client.request("shutdown"), "Gateway cleanup shutdown", 20_000); } finally { client.disconnect(); }
        await ctx.bounded(ctx.gateway.done, "Gateway cleanup exit", 20_000);
      } else {
        await ctx.stopProcess(ctx.gateway);
      }
    } catch (error) {
      errors.push(ctx.sanitizeError(error));
      try { await ctx.stopProcess(ctx.gateway, "SIGKILL"); } catch (cleanupError) { errors.push(ctx.sanitizeError(cleanupError)); }
    }
    ctx.evidence.cleanup.gateway = ctx.safeProcessRecord(ctx.gateway);
    ctx.gateway = undefined;
    if (ctx.config) {
      try {
        ctx.evidence.cleanup.kernelIdsAfterGatewayShutdown = await ctx.kernelIds();
        if (ctx.evidence.cleanup.requested) assert.deepEqual(ctx.evidence.cleanup.kernelIdsAfterGatewayShutdown, ctx.baselineKernelIds, "Normal Gateway stop closes only its own REPL processes");
      }
      catch (error) { errors.push(ctx.sanitizeError(error)); }
    }
  }
  if (ctx.sentinel) {
    try {
      await ctx.sentinel.close();
      ctx.evidence.cleanup.kernelIdsAfterSentinelClose = await ctx.kernelIds();
      if (ctx.evidence.cleanup.requested) assert.deepEqual(ctx.evidence.cleanup.kernelIdsAfterSentinelClose, [], "Closing the sentinel leaves no REPL process under the fixture");
    } catch (error) { errors.push(ctx.sanitizeError(error)); }
    ctx.sentinel = undefined;
  }
  if (ctx.runtimeRoot) {
    try {
      await rm(ctx.runtimeRoot, { recursive: true, force: true });
      ctx.evidence.cleanup.runtimeTempRemoved = !(await ctx.exists(ctx.runtimeRoot));
    } catch (error) { errors.push(ctx.sanitizeError(error)); }
    ctx.runtimeRoot = undefined;
  }
  if (errors.length) throw new AggregateError(errors, "Live acceptance cleanup failed.");
}
