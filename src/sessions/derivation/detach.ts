import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { DerivedSessionSchemas } from "../../plugins/sessions/session-types.ts";
import { DERIVED_DETACHED_TYPE } from "../../plugins/sessions/derivation-protocol.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../plugins/sessions/default-schema.ts";
import { readDerivedSession } from "./read-derived-session.ts";

export function detachDerivedSession(manager: SessionManager, schemas: DerivedSessionSchemas = DEFAULT_DERIVED_SCHEMAS): void {
  if (readDerivedSession(manager, schemas) === undefined) return;
  manager.appendCustomEntry(DERIVED_DETACHED_TYPE, { version: 1, sessionId: manager.getSessionId() });
}
