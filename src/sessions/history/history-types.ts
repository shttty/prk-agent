import type { KernelLanguage } from "../../kernel/kernel-types.ts";
import type { SessionContext, SessionManager } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { ToolMode } from "../../config/session/session-options.ts";
import type { CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";

export type PersistedThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type HistoryPageCursor = { readonly before?: string; readonly through?: string | null };

export interface BranchHistoryPage {
  readonly messages: SessionContext["messages"];
  readonly messageEntryIds: readonly string[];
  readonly historyBefore: string | null;
  readonly historyForkBefore: string | null;
  readonly compactions: { entryId: string; firstKeptEntryId: string; beforeEntryId: string | null; summary: string }[];
  readonly compactionEntryIds: readonly string[];
}


export interface SessionBinding extends SessionRetarget {
  readonly sessionId: string;
}
export type RecordIdentity = {
  readonly limits: LimitsOptions;
  readonly sessionId: string;
  sessionFile: string;
  manager: SessionManager;
};
export type HistoryRecord = RecordIdentity & {
  /** Mutable only through retarget(), which appends the durable selection first. */
  target: string;
  cwd: string;
};


export interface StoredIdentity {
  readonly label: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly sessionId: string;
  readonly sessionFile: string;
  readonly manager: SessionManager;
  readonly sleeping?: boolean;
  readonly archived?: ArchivedState;
}

export interface StoredSession extends StoredIdentity {
  readonly target: string;
  /** Absolute Python cwd of this session (the latest retarget's, else the one it was created with). */
  readonly cwd: string;
}

export interface ArchivedState {
  /** Native session ID whose archive operation included this session. */
  readonly group: string;
  readonly at: string;
  /** Kernel shutdown failed; a kernel may remain on the target. */
  readonly kernelOrphan?: boolean;
}

export interface SessionRetarget {
  readonly target: string;
  readonly cwd: string;
}



export interface NativeSessionState {
  readonly model?: string;
  readonly thinkingLevel?: PersistedThinkingLevel;
  readonly autoCompaction?: boolean;
  readonly autoRetry?: boolean;
  readonly scopedModels?: readonly string[];
  readonly toolMode?: ToolMode;
  readonly kernelLanguage?: KernelLanguage;
  readonly delegation?: DelegationLevel;
  readonly localTools?: boolean;
  readonly capabilities?: CapabilitySwitches;
}

export interface SessionReadIssue {
  readonly location: "active" | "archived" | "unknown";
  readonly label?: string;
  readonly target?: string;
  readonly archived?: ArchivedState;
  readonly sessionId?: string;
  readonly sessionFile: string;
  readonly reason: string;
}

export interface SessionReadFailure {
  readonly issue: SessionReadIssue;
  readonly error: Error;
  readonly permanent: boolean;
}

export interface HistoryContext {
  readonly limits: LimitsOptions;
  readonly directory: string;
  readonly records: Map<string, HistoryRecord>;
  readonly readFailures: Map<string, SessionReadFailure>;
}
