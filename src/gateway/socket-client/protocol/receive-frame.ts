import type { ClientContext } from "../client-state.ts";
import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";
import type { GatewayCollectionEvent } from "../../instance-environments/environment-types.ts";
import { isEnvironmentSnapshot } from "../../instance-environments/is-environment-snapshot.ts";
import type { TerminalEvent } from "../../../workspace/terminals/terminals-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { object } from "../../wire/is-record.ts";
import { keys } from "../../wire/fields/has-only-fields.ts";

export function receiveFrame(ctx: ClientContext, lose: () => void, value: unknown): void {
  const { pending, listeners, collectionListeners, terminalListeners } = ctx;
    if (!object(value) || value.v !== 1) { lose(); return; }
    if ("terminal" in value) {
      if (!keys(value, ["v", "sessionId", "name", "terminal"]) || !object(value.terminal) || typeof value.sessionId !== "string" || typeof value.name !== "string"
        || !["stdout", "closed", "resize"].includes(String(value.terminal.type))
        || (value.terminal.type === "stdout" && typeof value.terminal.data !== "string")
        || (value.terminal.type === "resize" && (!Number.isInteger(value.terminal.rows) || !Number.isInteger(value.terminal.cols)))) { lose(); return; }
      const event = value.terminal as unknown as TerminalEvent;
      const sessionId = value.sessionId, name = value.name;
      queueMicrotask(() => {
        try { for (const listener of terminalListeners) listener(event, sessionId, name); }
        catch { lose(); }
      });
      return;
    }
    if ("collection" in value) {
      if (!keys(value, ["v", "collection"]) || !object(value.collection)) { lose(); return; }
      if (value.collection.type === "target_environment_changed") {
        if (!keys(value.collection, ["type", "target", "timestamp", "details"]) || typeof value.collection.timestamp !== "string" || !object(value.collection.details) || !keys(value.collection.details, ["environment"]) || !isEnvironmentSnapshot(value.collection.details.environment) || value.collection.target !== value.collection.details.environment.target) { lose(); return; }
      } else if (!keys(value.collection, ["type", "sessionId", "timestamp", "details"]) || typeof value.collection.type !== "string" || !value.collection.type.startsWith("session_") || typeof value.collection.sessionId !== "string") { lose(); return; }
      const event = value.collection as unknown as GatewayCollectionEvent;
      queueMicrotask(() => {
        try { for (const listener of collectionListeners) listener(event); }
        catch { lose(); }
      });
      return;
    }
    if ("event" in value) {
      if (!keys(value, ["v", "sessionId", "event"]) || !object(value.event)
        || !keys(value.event, ["streamId", "sequence", "timestamp", "type", "sessionId", "requestId", "operationId", "text", "details"])
        || !Number.isSafeInteger(value.event.sequence) || typeof value.event.sessionId !== "string"
        || typeof value.event.streamId !== "string" || !value.event.streamId
        || typeof value.event.type !== "string" || typeof value.sessionId !== "string" || value.event.sessionId !== value.sessionId) { lose(); return; }
      const event = value.event as unknown as SessionHostEvent;
      const sessionId = value.sessionId;
      // Preserve snapshot-before-live for Promise consumers even when the reply
      // and subsequent events arrive in one socket chunk.
      queueMicrotask(() => {
        try { for (const listener of listeners) listener(event, sessionId); }
        catch { lose(); }
      });
      return;
    }
    if (!Number.isSafeInteger(value.id) || typeof value.ok !== "boolean") { lose(); return; }
    const entry = pending.get(value.id as number);
    if (!entry) { lose(); return; }
    pending.delete(value.id as number); clearTimeout(entry.timer);
    if (value.ok) entry.resolve(value.result);
    else if (object(value.error) && typeof value.error.code === "string" && typeof value.error.message === "string") {
      entry.reject(new WireError(value.error.code, value.error.message, object(value.error.details) ? value.error.details : undefined));
    } else { entry.reject(new WireError("CLIENT_ERROR","Invalid gateway response; outcome unknown.")); lose(); }
}
