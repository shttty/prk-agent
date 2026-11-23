import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import type { SessionRecord } from "../collection-types.ts";

export function newRecord(sessionManager: SessionManager, target: ExecutionTarget, cwd: string): SessionRecord {
  return {
    sessionId: sessionManager.getSessionId(),
    sessionManager,
    target,
    cwd,
    state: "idle",
    tombstoned: false,
    closeEventEmitted: false,
  };
}
