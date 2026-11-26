import type { OperationCompletion, SessionHostSnapshot } from "../../../src/gateway/wire/web-types.ts";

/** A snapshot that passed `normalizeSnapshot`: `recentOperations` is always present. */
export type NormalizedSnapshot = SessionHostSnapshot & { readonly recentOperations: readonly OperationCompletion[] };

/**
 * One entry of the workbench `unreadableSessions`: a session whose stored data cannot be read. `sessionId` is the native
 * SDK id and "" when the file's header identity is missing; `key` is the UI-only row key, not an id for any route.
 */
export type UnreadableSession = {
  key: string;
  location: "active" | "archived" | "unknown";
  sessionId: string;
  sessionFile: string;
  reason: string;
  label: string;
  target: string;
  archived: { group: string; at: string; kernelOrphan: boolean } | null;
};
