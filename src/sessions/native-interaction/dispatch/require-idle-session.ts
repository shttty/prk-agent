import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeTarget } from "../native-types.ts";

export function requireIdle(target: NativeTarget): AgentSession {
  if (target.readOnly || !target.session) throw new WireError("READ_ONLY", "This session is read-only history; no mutation was performed.");
  if (target.state !== "idle" || !target.session.isIdle) throw new WireError("BUSY", "Session is busy; wait for idle before changing native session state.");
  return target.session;
}
