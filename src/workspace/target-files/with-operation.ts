import type { FilesState, TargetFileContext, FileOperation } from "./files-types.ts";
import { acquireOperation } from "./acquire-operation.ts";
import { prepareOperation } from "./prepare-operation.ts";
import { withDeadline } from "./with-deadline.ts";

export async function withOperation<T>(state: FilesState, target: TargetFileContext, run: (op: FileOperation) => Promise<T>): Promise<T> {
  const scope = await acquireOperation(state, target);
  try {
    return await withDeadline(scope.lease, state.options.targetConnection.requestTimeoutMs, async () => {
      const op = await prepareOperation(state.options, scope.lease, target.cwd);
      return run(op);
    });
  } finally {
    await scope.release();
  }
}
