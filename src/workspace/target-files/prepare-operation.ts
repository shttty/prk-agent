import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { FileOperation, TargetFilesOptions } from "./files-types.ts";
import { request } from "./request.ts";

export async function prepareOperation(options: TargetFilesOptions, lease: TargetEnvironmentLease, cwdPath: string): Promise<FileOperation> {
  const op: FileOperation = { connection: lease.connection, requestOptions: { signal: lease.signal, session: await lease.connection.session() }, options };
  const cwd = await request(op, "opendir", { path: cwdPath });
  await request(op, "close", { handle: cwd.json.handle }, { signal: undefined, session: cwd.session });
  return op;
}
