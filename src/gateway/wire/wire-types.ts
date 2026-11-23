import type { methods } from "./method-parameters/method-constants.ts";

/**
 * Every session-scoped method carries an explicit routing identity. The Gateway
 * owns the whole managed collection; there is no implicit "current" session.
 */
/** Explicit input may create a new empty REPL; it never adopts or replays old execution. */
export type RecoveryMode = "new" | "auto";
export type { SessionManagementRequest } from "../../sessions/derivation/derivation-types.ts";
export type SendMode = "auto" | "plain";
export interface WireAttachment {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly data: string;
  readonly source?: "browser";
}
export interface WireReference {
  readonly type: "target-file" | "browser-upload" | "text";
  readonly source: "session-target" | "browser" | "user";
  readonly path?: string;
  readonly text?: string;
  readonly name?: string;
  readonly target?: string;
  readonly sessionId?: string;
  readonly label?: string;
}
export interface ExtendedSendRequest {
  readonly sessionId: string;
  readonly requestId: string;
  readonly message: string;
  readonly queue?: "steer" | "followUp";
  readonly mode?: SendMode;
  readonly source?: "web";
  readonly attachments?: readonly WireAttachment[];
  readonly references?: readonly WireReference[];
}
export interface NativeActionRequest {
  readonly sessionId: string;
  readonly requestId: string;
  readonly action: string;
  readonly args?: Record<string, unknown>;
}
export interface NativeActionResult {
  readonly requestId: string;
  readonly action: string;
  readonly command?: string;
  readonly status: "running" | "completed" | "failed" | "cancelled" | "unavailable" | "unknown";
  readonly message: string;
  readonly data?: unknown;
}
export type Method = typeof methods[number];
export interface Request { v: 1; id: number; method: Method; params: Record<string, unknown> }
export type Response = { v: 1; id: number | null; ok: true; result: unknown }
  | { v: 1; id: number | null; ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };
