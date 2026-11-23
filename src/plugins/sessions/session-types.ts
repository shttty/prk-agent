import type { Static } from "typebox";
import type { PeerDelivery } from "../../../shared/session-messages/message-types.js";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { DEFAULT_DERIVED_SCHEMAS } from "./default-schema.ts";

export interface DerivedSessionSchemas {
  readonly limits: LimitsOptions;
  readonly identity: typeof DEFAULT_DERIVED_SCHEMAS.identity;
  readonly resultSchema: typeof DEFAULT_DERIVED_SCHEMAS.resultSchema;
  readonly infoSchema: typeof DEFAULT_DERIVED_SCHEMAS.infoSchema;
  readonly spawnSchema: typeof DEFAULT_DERIVED_SCHEMAS.spawnSchema;
  readonly spawnResultSchema: typeof DEFAULT_DERIVED_SCHEMAS.spawnResultSchema;
  readonly receiptSchema: typeof DEFAULT_DERIVED_SCHEMAS.receiptSchema;
}
export type DerivedSessionInfo = Static<DerivedSessionSchemas["infoSchema"]>;
export type SpawnSessionRequest = Static<DerivedSessionSchemas["spawnSchema"]>;
export type SpawnTaskRequest = SpawnSessionRequest["tasks"][number];

export interface SessionIdentity {
  readonly depth: number;
  readonly parentLabel: string;
  readonly isolated?: boolean;
  readonly cwd?: string;
  readonly repoRoot?: string;
}

export interface AgentPeer {
  readonly sessionId: string;
  readonly label: string;
  readonly state: string;
  readonly owner?: string | null;
  readonly createdBy?: string;
  readonly pendingOwner?: string;
  readonly root?: boolean;
  readonly supervisor?: boolean;
  readonly projectId?: string;
  readonly derivation?: DerivedSessionInfo;
}

export interface SessionListRequest {
  readonly sessionId?: string;
  readonly limit?: number;
}

export interface SessionListRow {
  readonly sessionId: string;
  readonly sessionName: string;
  readonly state: string;
  readonly parentSessionId: string | null;
  readonly pendingParentSessionId?: string;
  readonly self?: true;
  readonly root?: true;
  readonly supervisor?: true;
}

export interface SessionObservation {
  readonly sessionId: string;
  readonly sessionName: string;
  readonly state: string;
  readonly parentSessionId: string | null;
  readonly phase?: "working" | "submitted" | "delivered";
  readonly role?: string;
  readonly result?: DerivedSessionInfo["result"];
  readonly recent: Array<{
    role: "user" | "assistant" | "toolResult";
    text: string;
    toolName?: string;
    isError?: boolean;
  }>;
}

export interface SessionSendRequest {
  readonly to: string;
  readonly message: string;
  readonly delivery?: PeerDelivery;
  readonly replyTo?: string;
  readonly expectReply?: boolean;
}
