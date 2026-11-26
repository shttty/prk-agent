import { isPayload } from "../../payload/is-payload.ts";
import type { TerminalEvent } from "../conversation-types.ts";

export function isTerminalEvent(value: unknown): value is TerminalEvent {
  return isPayload(value) && typeof value.kind === "string" && isPayload(value.result) && typeof value.result.name === "string";
}
