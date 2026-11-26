import type { SessionHostEvent, SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { PatchOptions, StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { patchSession } from "../updates/patch-session.ts";
import { ingestToolEvent } from "../../payloads/tool-runs/ingest-tool-event.ts";
import { updateSessionRow } from "../workbench-snapshot/update-session-row.ts";

const LIFECYCLE_STATES: readonly SessionRow["state"][] = ["starting", "running", "idle", "sleeping", "waking", "closing", "closed"];
const strings = (value: unknown[]): string[] => value.filter((item): item is string => typeof item === "string");

function patchSnapshot(ctx: StoreContext, fields: Partial<SessionHostSnapshot>, options?: PatchOptions) {
  const snapshot = ctx.state.session.snapshot;
  if (snapshot) patchSession(ctx, { snapshot: { ...snapshot, ...fields } }, options);
}

/** An SDK event relayed as `session_event`: its `details.sdkType` says which part of the snapshot or the tool runs it moves. */
export function handleSessionEvent(ctx: StoreContext, event: SessionHostEvent) {
  const details = event.details ?? {};
  // The Gateway built these lists and messages; they are taken as sent once their kind is right.
  if (Array.isArray(details.kernelCells)) patchSnapshot(ctx, { kernelCells: details.kernelCells as SessionHostSnapshot["kernelCells"] }, { displayOnly: true });
  const terminalMessage = isRecord(details.message) && details.message.customType === "terminal-event";
  if ((details.sdkType === "tool_execution_end" && String(details.toolName).startsWith("terminal_")) || (details.sdkType === "message_end" && terminalMessage)) {
    patchSession(ctx, { terminalRefreshKey: ctx.state.session.terminalRefreshKey + 1 });
  }
  if (details.sdkType === "queue_update" && Array.isArray(details.steering) && Array.isArray(details.followUp)) {
    patchSnapshot(ctx, { queuedMessages: { steering: strings(details.steering), followUp: strings(details.followUp) }, receivingUserText: typeof details.receivingUserText === "string" ? details.receivingUserText : null });
  }
  if (details.sdkType === "message_start" && typeof details.receivingUserText === "string") patchSnapshot(ctx, { receivingUserText: details.receivingUserText });
  if (details.sdkType === "message_end" && isRecord(details.message) && typeof details.message.role === "string") appendMessage(ctx, event, details.message);
  const toolRuns = ingestToolEvent(ctx.state.session.toolRuns, details, ctx.state.selectedSessionId || "session", event.operationId, event.timestamp);
  if (toolRuns !== ctx.state.session.toolRuns) patchSession(ctx, { toolRuns }, { displayOnly: details.sdkType !== "tool_execution_end" });
  const sessionState = safeText(details.lifecycleType).replace(/^session_/, "");
  const rowState = LIFECYCLE_STATES.find((state) => state === sessionState);
  if (event.sessionId && rowState) updateSessionRow(ctx, event.sessionId, { state: rowState });
}

/** The finished message joins the held snapshot until the authoritative one replaces it; its live text segments are done. */
function appendMessage(ctx: StoreContext, event: SessionHostEvent, message: Record<string, unknown>) {
  const snapshot = ctx.state.session.snapshot;
  if (!snapshot) return;
  const operationId = safeText(event.operationId) || "live";
  const assistant = message.role === "assistant";
  const streams = assistant && ctx.state.session.streams.has(operationId)
    ? new Map([...ctx.state.session.streams].filter(([key]) => key !== operationId))
    : ctx.state.session.streams;
  // External input boundary: the Gateway's SDK message, taken as sent.
  const stored = message as unknown as SessionHostSnapshot["messages"][number];
  const next = assistant && message.stopReason === "error"
    ? snapshot
    : { ...snapshot, messages: [...snapshot.messages, stored], ...(message.role === "user" ? { receivingUserText: null } : {}) };
  patchSession(ctx, { snapshot: next, streams }, { displayOnly: assistant });
}
