import { object } from "../wire/is-record.ts";

/** Low-cardinality kind of an outgoing frame for metrics, plus the session it belongs to. */
export function describeFrame(value: unknown): { readonly kind: string; readonly sessionId: string | undefined } {
  if (!object(value)) return { kind: "frame_other", sessionId: undefined };
  const event = object(value.event) ? value.event : undefined;
  const result = object(value.result) ? value.result : undefined;
  const sessionId = [value.sessionId, event?.sessionId, result?.sessionId].find((id): id is string => typeof id === "string");
  if ("ok" in value) return { kind: "frame_response", sessionId };
  if (event) return { kind: event.type === "snapshot" ? "frame_snapshot" : "frame_event", sessionId };
  if (value.collection !== undefined) return { kind: "frame_collection", sessionId };
  if (value.terminal !== undefined) return { kind: "frame_terminal", sessionId };
  return { kind: "frame_other", sessionId };
}
