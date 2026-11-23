import { readFileSync } from "node:fs";
import { RemoteError } from "@earendil-works/pi-env";
import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import type { KernelRetirementReceipt, KernelRetirementRequest } from "../kernel-types.ts";
import { retire } from "./retire.ts";
import { waitBeforeAbort } from "./wait-before-abort.ts";
import { controlForkserver } from "./control-forkserver.ts";

export function stop(ctx: KernelContext, process: KernelProcess,
  command: KernelRetirementRequest | { failure: unknown }): Promise<KernelRetirementReceipt | undefined> {
  if (process.stopping) return process.stopping;
  const stopping = Promise.withResolvers<KernelRetirementReceipt | undefined>();
  process.stopping = stopping.promise;
  const request = "cause" in command ? command : undefined;
  const reason = "failure" in command ? command.failure : new Error("Kernel generation closed.");
  void (async () => {
    const retirement = retire(ctx, process, reason, request);
    // Loss is unknown even if we subsequently prove there is nothing left to clean up.
    if (!request) retirement.settle(false);
    let failed = false;
    let failure: unknown;
    try { await confirmStop(ctx, process); }
    catch (error) { failed = true; failure = error; }
    if (request) retirement.settle(!failed);
    // Includes cell_end already observed, but not unsubmitted cells awaiting startup.
    await retirement.released;
    try {
      await waitBeforeAbort(process.lease.release(), AbortSignal.timeout(ctx.options.closeTimeoutMs));
    } catch (error) {
      if (!failed) { failed = true; failure = error; }
    }
    if (!failed) return retirement.receipt;
    const daemonPid = process.process?.pid;
    const details = {
      closed: true, cleanup: "unconfirmed", kernelId: process.generation,
      ...(retirement.receipt && { cause: retirement.receipt.cause, initiatorCellId: retirement.receipt.initiatorCellId,
        affectedCells: retirement.receipt.affectedCells }),
      ...(process.scoped && process.deploymentSent ? { scope: process.scope } : {}),
      ...(daemonPid === undefined ? {} : { daemonPid, daemonPgid: daemonPid }),
      ...(process.pid === undefined ? {} : { pid: process.pid }),
      ...(process.pgid === undefined ? {} : { pgid: process.pgid }),
    };
    // Pi can report thrown tool failures as text; retain the affected identities there too.
    throw Object.assign(new Error(`Kernel closed; owned process cleanup unconfirmed.\n${JSON.stringify(details)}`, { cause: failure }),
      { code: "UNAVAILABLE", details });
  })().then(stopping.resolve, stopping.reject);
  return process.stopping;
}

async function confirmStop(ctx: KernelContext, process: KernelProcess) {
  if (!process.opening) return; // Fenced before requesting a daemon process.
  const deadline = AbortSignal.timeout(ctx.options.closeTimeoutMs);
  try { await waitBeforeAbort(process.opening, deadline); }
  catch (error) {
    if (!process.process) {
      if (error instanceof RemoteError && (error.code === "spawn_error" || error.code === "not_supported")) return;
      throw error; // The open may still have created a process for which we have no identity.
    }
  }
  const daemonPid = process.process!.pid;
  if ([daemonPid, process.pid, process.pgid].some((id) => id !== undefined && (!Number.isSafeInteger(id) || id <= 1))) {
    throw new Error("Invalid owned kernel process identity.");
  }
  const signal = AbortSignal.any([deadline, process.lease.signal]);
  signal.throwIfAborted();
  let forkserverFailure: unknown;
  if (!process.scoped && process.isolatedSubmitted) {
    // Private groups are not members of the daemon's PGID. Fence further forks
    // and get exit proof before asking the daemon to terminate the service.
    const timeoutMs = Math.max(1, Math.floor(ctx.options.closeTimeoutMs / 3));
    try {
      const status = await controlForkserver(ctx, process, { kind: "retire" }, timeoutMs,
        AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]));
      if (status !== "reaped") throw new Error("Owned isolated groups did not empty.");
    } catch (error) { forkserverFailure = error; }
  }
  if (process.language === "python" && process.deploymentSent) {
    // Give the bootstrap a chance to close its private channel and reap the forkserver.
    // Leave time for the existing group/scope cleanup if the runner cannot read EOF.
    process.process!.closeStdin();
    const grace = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.floor(ctx.options.closeTimeoutMs / (process.isolatedSubmitted ? 3 : 2))))]);
    await waitBeforeAbort(process.process!.exited, grace).catch(() => {});
    signal.throwIfAborted();
  }
  process.cancelProcess?.();
  const { closeTimeoutMs, cleanupPollMs } = ctx.options;
  const source = readFileSync(new URL("./confirm-stop.py", import.meta.url), "utf8");
  const reply = await waitBeforeAbort(process.lease.connection.request("exec", {
    cwd: ctx.configuration.cwd, timeoutMs: closeTimeoutMs,
    argv: [ctx.configuration.python, "-c", source, String(daemonPid), String(process.pid ?? 0), String(process.pgid ?? 0),
      process.scoped && process.deploymentSent ? process.scope : "", String(closeTimeoutMs / 1000), String(cleanupPollMs / 1000)],
  }, { signal }), signal);
  if (reply.json.exitCode !== 0) throw new Error("Owned kernel scope or process group did not empty.");
  if (forkserverFailure) throw forkserverFailure;
}
