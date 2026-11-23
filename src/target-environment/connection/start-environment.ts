import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RemoteInfo } from "@earendil-works/pi-env";
import type { EnvironmentsContext, EnvironmentRecord } from "./connection-state.ts";
import { PI_ENV_VERSION } from "../daemon/daemon-version.ts";
import { retireEnvironment } from "./retire-environment.ts";

export async function startEnvironment(ctx: EnvironmentsContext, record: EnvironmentRecord): Promise<RemoteInfo> {
  try {
    record.directory = await mkdtemp(join(tmpdir(), "prk-env-"));
    const socket = join(record.directory, "s");
    const listening = Promise.withResolvers<void>();
    record.server.once("error", listening.reject);
    record.server.listen(socket, listening.resolve);
    await listening.promise;
    const info = await record.connection.info();
    if (info.version !== PI_ENV_VERSION || info.protocol !== 1 || !info.features?.includes("process")) {
      throw new Error(`Unsupported pi-env hello ${info.version}/${info.protocol}`);
    }
    if (record.abort.signal.aborted) throw record.failure;
    return info;
  } catch (error) {
    if (!record.sockets.size) record.exited.resolve();
    const cause = record.failure ?? (error instanceof Error ? error : new Error(String(error)));
    await retireEnvironment(ctx, record, cause);
    throw record.failure;
  }
}
