import { isPayload } from "../../payload/is-payload.ts";
import type { KernelEvent } from "../conversation-types.ts";

export function isKernelEvent(value: unknown): value is KernelEvent {
  return isPayload(value) && typeof value.kind === "string" && typeof value.cellId === "string";
}
