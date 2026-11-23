import type { SessionControl } from "../../sessions/session-control/control-types.ts";
import type { ManagedSessionSnapshot } from "../../sessions/collection/collection-types.ts";
import type { PublicExecutionTarget } from "../instances/instance-types.ts";
import type { ArchiveGroup } from "../archives/archive-types.ts";
import type { SessionHostSnapshot } from "../../sessions/host/host-types.ts";
import type { SessionReadIssue } from "../../sessions/history/history-types.ts";

export type SessionSnapshot = ManagedSessionSnapshot;

export interface WorkbenchSnapshot {
  readonly targets: readonly PublicExecutionTarget[];
  readonly sessions: readonly SessionSnapshot[];
  /** Archive: each group is one archiving (root plus the children archived with it). */
  readonly archive: readonly ArchiveGroup[];
  readonly unreadableSessions: readonly SessionReadIssue[];
  /** Root/supervisor designations; `session_control_changed` carries later values. */
  readonly sessionControl: SessionControl;
}

export interface RecoverSessionRequest {
  /** Explicit new input may create an empty REPL; old execution is never replayed. */
  readonly mode: "new" | "auto";
  /** Forced move to a new execution environment (mode "new" only). */
  readonly target?: string;
  readonly cwd?: string;
}

export interface CreatedSession {
  readonly session: SessionSnapshot;
  readonly snapshot: SessionHostSnapshot;
}
