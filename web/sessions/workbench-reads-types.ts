import type { ArchiveGroup, PublicExecutionTarget, SessionControl, SessionHostSnapshot } from "../../src/gateway/wire/web-types.ts";
import type { SessionRows, UnreadableIssue } from "./session-row-types.ts";

/** One line of the session's run log (the details dialog's 运行记录). */
export type Activity = { id: string; tone?: string; title: string; time?: string | number; meta?: string; output?: string };

/** The native catalog a session offers: its tool target, light-setting values, switchable actions and loaded resources. */
export type NativeCatalog = {
  target?: { local?: boolean; current?: { autoCompaction?: boolean; autoRetry?: boolean } };
  actions?: { name: string; enabled?: boolean }[];
  resources?: { type?: string; name?: string; path?: string; code?: string; providers?: string[]; loaded?: boolean; disabled?: boolean; reason?: string }[];
};

/** The fields of the workbench state that sessions, monitor and instances select from (`useWorkbench((state: WorkbenchReads) => ...)`). */
export type WorkbenchReads = {
  service: "loading" | "ready" | "error";
  targets: PublicExecutionTarget[];
  sessions: SessionRows;
  archive: ArchiveGroup[];
  unreadableSessions: UnreadableIssue[];
  sessionControl: SessionControl | null;
  selectedSessionId: string | null;
  viewMode: "instances" | "projects";
  workbenchLinked: boolean;
  workbenchLinkLosses: number;
  pending: ReadonlySet<string>;
  queue: string;
  session: {
    pending: ReadonlySet<string>;
    connection: "connected" | "connecting" | "disconnected";
    error: string | null;
    streamId: string | null;
    snapshot: SessionHostSnapshot | null;
    nativeCatalog: { value: NativeCatalog | null };
    activities: Activity[];
    recoveryMessage: string;
  };
};
