import { Value } from "typebox/value";
import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";
import { DERIVED_SESSION_TYPE } from "../../../plugins/sessions/derivation-protocol.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function save(ctx: DerivationContext, sessionId: string, value: DerivedSessionInfo): void {
    const manager = ctx.env.get(sessionId).manager;
    const persisted = { ...value, sessionId: manager.getSessionId() };
    if (!Value.Check(ctx.schemas.infoSchema, persisted)) throw new Error("Invalid derived-session transition.");
    manager.appendCustomEntry(DERIVED_SESSION_TYPE, persisted);
    ctx.env.publish(sessionId);
  }
