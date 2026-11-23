import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import { SessionReadError } from "../../../sessions/history/read-error.ts";
import { readDerivedSession } from "../../../sessions/derivation/read-derived-session.ts";
import { describeReadFailure } from "./describe-read-failure.ts";

export function readSessionDerivation(ctx: HostContext, entry: StoredSession) {
  try {
    return readDerivedSession(entry.manager, ctx.derivation.derivationSchemas);
  }
  catch (cause) { throw new SessionReadError(describeReadFailure(entry, cause), cause); }
}
