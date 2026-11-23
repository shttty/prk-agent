import { WireError } from "../../gateway/wire/create-error.ts";
import type { FilesState, TargetFileContext } from "./files-types.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export async function acquireOperation(state: FilesState, target: TargetFileContext) {
  absolutePath(target.cwd);
  if (state.active >= state.options.workspace.fileRequestsMax) throw new WireError("BUSY", "Target file request capacity is full.");
  state.active++;
  try {
    const lease = await state.options.environments.acquire(target.target);
    return { lease, async release() {
      try { await lease.release(); } finally { state.active--; }
    } };
  } catch (error) {
    state.active--;
    throw error;
  }
}
