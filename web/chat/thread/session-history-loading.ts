import type { WorkbenchState } from "../../workbench/store/store-types.ts";

/** Whether the selected session is still waiting for its initial snapshot before showing an empty prompt. */
export function sessionHistoryLoading(state: WorkbenchState | undefined) {
  return Boolean(state?.selectedSessionId) && !state?.session?.snapshot && !state?.session?.error && state?.session?.connection !== "disconnected";
}
