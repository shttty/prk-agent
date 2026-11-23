import { Value } from "typebox/value";
import { projectAuthorityEntries } from "../../src/sessions/history/format-authority-entries.ts";
import { oneBinding } from "../../src/sessions/history/binding/read-creation-binding.ts";
import { latestRetarget } from "../../src/sessions/history/binding/read-target-selection.ts";
import { latestProject } from "../../src/sessions/history/metadata/read-project.ts";
import { latestSleeping } from "../../src/sessions/history/metadata/read-sleep-state.ts";
import { latestArchivedState } from "../../src/sessions/history/archive/read-archive-state.ts";
import { readNativeSessionState } from "../../src/sessions/history/read-native-session-state.ts";
import { createDerivedSessionSchemas } from "../../src/plugins/sessions/create-derived-session-schemas.ts";

export function validateHistory(manager, entries, limits) {
  const projected = new Set(projectAuthorityEntries(manager, limits).map(({ id }) => id));
  const authority = entries.filter(({ id }) => projected.has(id));
  const binding = oneBinding(authority, limits);
  if (binding && binding.sessionId !== manager.getSessionId()) throw new Error("Invalid binding session identity");
  if (binding && manager.getSessionName() === undefined) throw new Error("PRK session has no SDK title");
  readNativeSessionState(manager, limits);
  const schemas = createDerivedSessionSchemas(limits);
  for (const entry of entries) {
    if (entry.type !== "custom") continue;
    oneBinding([entry], limits);
    latestRetarget([entry], limits);
    latestProject([entry], limits);
    latestSleeping([entry], limits);
    latestArchivedState([entry], limits);
    const schema = entry.customType === "gateway-derived-session" ? schemas.infoSchema
      : entry.customType === "gateway-derived-receipt" ? schemas.receiptSchema : undefined;
    if (schema && !Value.Check(schema, entry.data)) throw new Error(`Invalid ${entry.customType} metadata at ${entry.id}`);
  }
}
