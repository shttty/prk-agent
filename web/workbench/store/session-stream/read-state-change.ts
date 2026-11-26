import type { HostOperationSnapshot, KernelSnapshot, SessionHostSnapshot, HostState } from "../../../../src/gateway/wire/web-types.ts";
import type { StateChange } from "./session-stream-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** What a `state_changed` event's `details` says about the session; the Gateway built these values, so each is taken as sent once its kind is right. */
export function readStateChange(details: Readonly<Record<string, unknown>> | undefined): StateChange {
  if (!details) return {};
  return {
    ...(typeof details.state === "string" ? { state: details.state as HostState } : {}),
    ...(Object.hasOwn(details, "operation") ? { operation: isRecord(details.operation) ? details.operation as unknown as HostOperationSnapshot : undefined } : {}),
    ...(isRecord(details.kernel) ? { kernel: details.kernel as unknown as KernelSnapshot } : {}),
    ...(Array.isArray(details.kernelCells) ? { kernelCells: details.kernelCells as SessionHostSnapshot["kernelCells"] } : {}),
    ...(Array.isArray(details.terminals) ? { terminals: details.terminals as SessionHostSnapshot["terminals"] } : {}),
  };
}
