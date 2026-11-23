import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SpawnTaskRequest } from "../../plugins/sessions/session-types.ts";
import type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";

export type SessionManagementRequest =
  | { action: "transfer"; owner: string }
  | { action: "upgrade" };

export interface SessionEntry {
  sessionId: string;
  label: string;
  manager: SessionManager;
}

export interface DerivationEnvironment {
  list(): readonly SessionEntry[];
  get(sessionId: string): SessionEntry;
  spawn(parent: string, request: SpawnTaskRequest, context: string): Promise<{ sessionId: string; sessionName: string; taskId: string }>;
  prepareResult(sessionId: string, state: DerivedSessionInfo): Promise<NonNullable<DerivedSessionInfo["result"]>["patch"]>;
  /** Close each session (best effort for kernels) and archive it under `group`; history files are kept. */
  destroy(sessionIds: readonly string[], group: string): Promise<void>;
  /** Enqueue through the same recipient inbox as session_send; never replay. */
  deliver(from: string, to: string, text: string): Promise<void>;
  finishTemporarySession(sessionId: string): void;
  canControl(actor: string, target: string): boolean;
  setProject(actor: string, target: string, project: string | null): unknown;
  setSupervisor(actor: string, target: string): unknown;
  publish(sessionId: string): void;
  log(message: string, error?: unknown): void;
}
