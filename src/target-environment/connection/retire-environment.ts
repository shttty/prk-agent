import { rm } from "node:fs/promises";
import type { EnvironmentsContext, EnvironmentRecord } from "./connection-state.ts";
import { TargetUnreachableError } from "../../target-channel/connection-error/create-target-unreachable-error.ts";

export function retireEnvironment(ctx: EnvironmentsContext, record: EnvironmentRecord, error: Error): Promise<void> {
  if (record.closing) return record.closing;
  const completion = Promise.withResolvers<void>();
  record.closing = completion.promise;
  record.failure = new TargetUnreachableError(record.id, undefined, error);
  record.abort.abort(record.failure);
  if (ctx.records.get(record.id) === record) ctx.records.delete(record.id);
  void (async () => {
    record.connection.close();
    // Connection owns the wrapper. Its SIGTERM handler closes only its login process group.
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = Promise.withResolvers<void>();
      timer = setTimeout(() => timeout.reject(new Error("Wrapper exit unconfirmed after 3 s")), 3000);
      await Promise.race([record.exited.promise, timeout.promise]);
    } finally {
      clearTimeout(timer);
      for (const socket of record.sockets) socket.destroy();
      const closed = Promise.withResolvers<void>();
      record.server.close(() => closed.resolve());
      await closed.promise;
      if (record.directory) await rm(record.directory, { recursive: true, force: true });
    }
  })().then(completion.resolve, completion.reject);
  record.closing.catch(() => {});
  return record.closing;
}
