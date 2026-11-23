import { BINDING_TYPE } from "../../../src/sessions/history/history-protocol.ts";
import { LEGACY_BINDING_TYPE } from "../metadata/legacy-types.mjs";

export function buildSessionIdentities(sessions, issues) {
  const byId = new Map();
  const byName = new Map();
  for (const session of sessions) {
    const records = byId.get(session.id) ?? [];
    records.push(session);
    byId.set(session.id, records);
  }
  for (const [id, records] of byId) {
    if (records.length > 1) issues.push(`Pi id ${JSON.stringify(id)} occurs in multiple files: ${records.map((record) => record.path).join(", ")}`);
  }
  const native = (value, location) => {
    const records = typeof value === "string" ? byId.get(value) : undefined;
    if (records?.length === 1) return value;
    issues.push(`${location}: ${records?.length ? "ambiguous" : "missing"} Pi id ${JSON.stringify(value)}${records?.length ? `: ${records.map((record) => record.path).join(", ")}` : ""}`);
    return undefined;
  };
  for (const session of sessions) {
    let ownBindings = 0;
    for (const line of session.lines) {
      const entry = line.value;
      if (entry?.type !== "custom" || ![LEGACY_BINDING_TYPE, BINDING_TYPE].includes(entry.customType)) continue;
      const location = `${session.path}:${line.line} (${entry.customType})`;
      const data = entry.data;
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        issues.push(`${location}: missing binding data`);
        continue;
      }
      const id = native(data.sessionId, `${location}/sessionId`);
      if (id === session.id) ownBindings++;
      if (entry.customType === LEGACY_BINDING_TYPE) {
        if (typeof data.name !== "string" || !data.name.trim()) {
          issues.push(`${location}/name: missing legacy routing name`);
        } else if (id !== undefined) {
          const references = byName.get(data.name) ?? [];
          references.push({ id, location });
          byName.set(data.name, references);
        }
      }
    }
    if (ownBindings > 1) issues.push(`${session.path}: multiple creation bindings for Pi id ${JSON.stringify(session.id)}`);
    if (ownBindings === 0 && session.lines.some((line) => line.value?.type === "custom"
      && [LEGACY_BINDING_TYPE, BINDING_TYPE].includes(line.value.customType))) {
      issues.push(`${session.path}: no creation binding for Pi header.id ${JSON.stringify(session.id)}`);
    }
  }
  for (const [name, references] of byName) {
    if (new Set(references.map((reference) => reference.id)).size > 1) {
      issues.push(`Legacy route ${JSON.stringify(name)} maps to multiple Pi ids: ${references.map((reference) => `${reference.id} at ${reference.location}`).join("; ")}`);
    }
  }
  const route = (value, location) => {
    const references = typeof value === "string" ? byName.get(value) ?? [] : [];
    const ids = [...new Set(references.map((reference) => reference.id))];
    if (ids.length === 1) return native(ids[0], location);
    issues.push(`${location}: ${ids.length ? "ambiguous" : "missing"} legacy route ${JSON.stringify(value)}${references.length ? `: ${references.map((reference) => `${reference.id} at ${reference.location}`).join("; ")}` : ""}`);
    return undefined;
  };
  const reference = (value, location) => {
    const candidates = [
      ...(byId.get(value) ?? []).map((session) => ({ id: session.id, location: `${session.path}/header.id` })),
      ...(byName.get(value) ?? []),
    ];
    const ids = [...new Set(candidates.map((candidate) => candidate.id))];
    if (ids.length === 1) return native(ids[0], location);
    issues.push(`${location}: ${ids.length ? "ambiguous" : "missing"} session reference ${JSON.stringify(value)}${candidates.length ? `: ${candidates.map((candidate) => `${candidate.id} at ${candidate.location}`).join("; ")}` : ""}`);
    return undefined;
  };
  return { native, route, reference };
}
