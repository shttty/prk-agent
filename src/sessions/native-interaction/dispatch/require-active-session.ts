import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeTarget } from "../native-types.ts";

export function requireActiveSession(target: NativeTarget): AgentSession {
  if (target.readOnly || target.state === "sleeping" || !target.session) throw new WireError("READ_ONLY", "This session has no active mutable SDK runtime.");
  return target.session;
}
