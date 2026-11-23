import { ARCHIVED_STATE_TYPE, BINDING_TYPE, PROJECT_TYPE, SUBJECT_SCOPED_AUTHORITY_TYPES } from "../../../src/sessions/history/history-protocol.ts";
import { DERIVED_SESSION_TYPE, RECEIPT_TYPE } from "../../../src/plugins/sessions/derivation-protocol.ts";
import { LEGACY_BINDING_TYPE, LEGACY_KERNEL_BINDING_TYPE, RENAMED_TYPES } from "./legacy-types.mjs";

export function rewriteMetadata(entry, location, identities, issues) {
  if (entry.type !== "custom") return entry;
  const customType = RENAMED_TYPES.get(entry.customType) ?? entry.customType;
  const subjectScoped = Object.hasOwn(SUBJECT_SCOPED_AUTHORITY_TYPES, customType) || customType === "gateway-session-kernel-binding";
  if (!subjectScoped && customType !== PROJECT_TYPE) return entry;
  if (entry.data === null || typeof entry.data !== "object" || Array.isArray(entry.data)) {
    issues.push(`${location}: missing ${entry.customType} data`);
    return entry;
  }
  const data = { ...entry.data };
  if (subjectScoped) {
    data.sessionId = identities.native(data.sessionId, `${location}/data/sessionId`);
  }
  if (customType === BINDING_TYPE) {
    const expectedVersion = entry.customType === LEGACY_BINDING_TYPE ? 2 : 3;
    if (data.version !== expectedVersion) issues.push(`${location}/data/version: unsupported binding version ${JSON.stringify(data.version)}`);
    for (const field of ["target", "kernelName", "cwd"]) {
      if (typeof data[field] !== "string" || !data[field].trim()) issues.push(`${location}/data/${field}: missing binding value`);
    }
    // This identity migration emits pre-PIENV v3; the separate cutover owns v4.
    data.version = 3;
  }
  if (entry.customType === LEGACY_BINDING_TYPE || entry.customType === LEGACY_KERNEL_BINDING_TYPE) {
    const id = identities.route(data.name, `${location}/data/name`);
    if (id !== undefined && data.sessionId !== undefined && id !== data.sessionId) {
      issues.push(`${location}: routing name ${JSON.stringify(data.name)} maps to ${JSON.stringify(id)}, not subject ${JSON.stringify(data.sessionId)}`);
    }
    delete data.name;
  }
  if (customType === DERIVED_SESSION_TYPE) {
    data.createdBy = identities.reference(data.createdBy, `${location}/data/createdBy`);
    if (data.owner !== null) data.owner = identities.reference(data.owner, `${location}/data/owner`);
    if (Object.hasOwn(data, "pendingOwner")) data.pendingOwner = identities.reference(data.pendingOwner, `${location}/data/pendingOwner`);
  }
  if (customType === RECEIPT_TYPE) data.child = identities.reference(data.child, `${location}/data/child`);
  if (customType === ARCHIVED_STATE_TYPE && data.trashed === true) data.group = identities.reference(data.group, `${location}/data/group`);
  return { ...entry, customType, data };
}
