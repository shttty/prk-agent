import type { JsonValue } from "@earendil-works/pi-ai";
import type { Static } from "typebox";
import type { SessionOptions } from "../../config/session/session-options.ts";
import type { PeerReceipt } from "../../sessions/host/host-types.ts";
import type { DerivedSessionInfo, DerivedSessionSchemas, SessionIdentity, SessionListRequest, SessionListRow, SessionObservation, SessionSendRequest, SpawnSessionRequest } from "./session-types.ts";

/** Bound to one Gateway session; the plugin never owns history, control or delivery state. */
export interface SessionsGateway {
  readonly schemas: DerivedSessionSchemas;
  readonly sessionOptions: Pick<SessionOptions, "maxMessageChars" | "expectReplyForNewMessages" | "expectReplyForReplies">;
  spaceStatus(target?: string): Promise<JsonValue>;
  spawn(request: SpawnSessionRequest): Promise<Static<DerivedSessionSchemas["spawnResultSchema"]>>;
  submit(summary: string, artifacts: string[], output?: unknown): Promise<{ resultId: string; phase: "working" | "submitted" | "delivered"; patch?: NonNullable<DerivedSessionInfo["result"]>["patch"] }>;
  destroy(child: string): Promise<unknown>;
  transfer(child: string, to: string): Promise<unknown>;
  accept(child: string): Promise<unknown>;
  setProject(session: string, project: string | null): unknown;
  setSupervisor(session: string): unknown;
  list(request?: SessionListRequest): Promise<readonly SessionListRow[] | SessionObservation>;
  send(request: SessionSendRequest): Promise<PeerReceipt & { id: string; to: string; expectReply: boolean }>;
  identity(): SessionIdentity | undefined;
}
