import type { HostState } from "../../../../src/gateway/wire/web-types.ts";
import type { SessionRow } from "../store-types.ts";

/** The list row state of a session whose host reports `state`: a cancel in progress still reads as running. */
export function rowStateOf(state: HostState): SessionRow["state"] {
  return state === "cancel_requested" ? "running" : state;
}
