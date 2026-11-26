import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import * as Schema from "typebox/schema";
import { projectAuthorityEntries } from "../history/format-authority-entries.ts";
import type { DerivedSessionSchemas } from "../../plugins/sessions/session-types.ts";
import type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";
import { DERIVED_SESSION_TYPE } from "../../plugins/sessions/derivation-protocol.ts";
import { DERIVED_DETACHED_TYPE } from "../../plugins/sessions/derivation-protocol.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../plugins/sessions/default-schema.ts";

export function readDerivedSession(manager: SessionManager, schemas: DerivedSessionSchemas = DEFAULT_DERIVED_SCHEMAS): DerivedSessionInfo | undefined {
  const entries = projectAuthorityEntries(manager, schemas.limits);
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry?.type === "custom" && entry.customType === DERIVED_DETACHED_TYPE) return undefined;
    if (entry?.type !== "custom" || entry.customType !== DERIVED_SESSION_TYPE) continue;
    if (!Value.Check(schemas.infoSchema, entry.data)) {
      const [, errors] = Schema.Errors(schemas.infoSchema, entry.data);
      throw new Error(`Invalid persisted derived-session metadata: ${errors.map((error) => `${error.instancePath || "/"}: ${error.message}`).join("; ")}`);
    }
    return structuredClone(entry.data);
  }
  return undefined;
}
