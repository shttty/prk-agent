import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { Connection, type RemoteInfo } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "./connection-types.ts";
import type { EnvironmentsContext, EnvironmentRecord } from "./connection-state.ts";
import { observeWrapper } from "./observe-wrapper.ts";
import { startEnvironment } from "./start-environment.ts";
import { retireEnvironment } from "./retire-environment.ts";

export async function acquireEnvironment(ctx: EnvironmentsContext, id: string): Promise<TargetEnvironmentLease> {
  let record = ctx.records.get(id);
  if (!record) {
    if (ctx.records.size >= 16) throw new Error("Target connection limit is 16");
    const input = ctx.options.resolve(id);
    if (!input.local && (!input.command || input.command.includes("\0") || Buffer.byteLength(input.command) > 65536)) {
      throw new Error("Target command must be nonempty, NUL-free and at most 64 KiB");
    }
    const server = createServer((socket) => observeWrapper(ctx, created, socket));
    const ready = Promise.withResolvers<RemoteInfo>();
    let started = false;
    const connection = new Connection({
      command: async () => {
        if (started || created.abort.signal.aborted) throw new Error("Retired target generation cannot reconnect");
        started = true;
        return [process.execPath, new URL("../daemon/run-wrapper.mjs", import.meta.url).pathname,
          `${created.directory}/s`, JSON.stringify({ ...input, targetCacheRoot: ctx.options.targetCacheRoot })];
      },
      onLog: (text) => ctx.options.onLog?.(id, text),
    });
    const created: EnvironmentRecord = {
      id, input, server, directory: "", generation: randomUUID(), abort: new AbortController(),
      sockets: new Set(), exited: Promise.withResolvers<void>(), consumers: 0,
      connection, ready: ready.promise,
    };
    record = created;
    ctx.records.set(id, record);
    void startEnvironment(ctx, record).then(ready.resolve, ready.reject);
  }
  const current = record;
  if (current.consumers >= 64) throw new Error("Target consumer limit is 64");
  current.consumers++;
  let info;
  try { info = await current.ready; }
  catch (error) { current.consumers--; throw error; }
  let released = false;
  return {
    connection: current.connection, info, generation: current.generation, signal: current.abort.signal,
    retire: (reason) => retireEnvironment(ctx, current, reason),
    release: async () => {
      if (released) return current.closing;
      released = true;
      if (--current.consumers === 0) await retireEnvironment(ctx, current, new Error("Last target consumer released"));
    },
  };
}
