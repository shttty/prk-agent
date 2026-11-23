import { SessionManager } from "@earendil-works/pi-coding-agent";
import { basename, dirname, join } from "node:path";
import { BINDING_TYPE } from "../../../src/sessions/history/history-protocol.ts";
import { LEGACY_BINDING_TYPE } from "../metadata/legacy-types.mjs";

export function readSession(file, issues) {
  const fileIssues = [];
  const lines = file.text.split(/(?<=\n)/u).map((raw, index) => {
    if (!raw.trim()) return { raw, line: index + 1 };
    try {
      const value = JSON.parse(raw);
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");
      return { raw, line: index + 1, value };
    } catch (error) {
      fileIssues.push(`${file.path}:${index + 1}: invalid JSONL: ${error.message}`);
      return { raw, line: index + 1 };
    }
  });
  const entries = lines.filter((line) => line.value !== undefined);
  const header = entries[0]?.value;
  const bindings = entries.filter((line) => line.value.type === "custom" && [LEGACY_BINDING_TYPE, BINDING_TYPE].includes(line.value.customType));
  const hasIdentity = header?.type === "session" && typeof header.id === "string" && header.id.trim().length > 0;
  const managed = hasIdentity && bindings.some((line) => line.value.data?.sessionId === header.id);
  if (bindings.length === 0 || (hasIdentity && !managed)) {
    return { ...file, id: header?.id, header, lines, headerLine: entries[0], managed: false, destination: file.path };
  }
  issues.push(...fileIssues);
  if (header?.type !== "session" || typeof header.id !== "string" || !header.id.trim()
    || typeof header.cwd !== "string" || !header.cwd.trim()) {
    issues.push(`${file.path}: missing Pi session header with nonempty id and cwd`);
    return undefined;
  }
  if (entries.slice(1).some((line) => line.value.type === "session")) {
    issues.push(`${file.path}: multiple Pi session headers`);
    return undefined;
  }
  const id = header.id;
  if (basename(id) !== id || id === "." || id === ".." || id.includes("\\") || /\p{Cc}/u.test(id)) {
    issues.push(`${file.path}:${entries[0].line}: Pi id cannot be used as a session filename: ${JSON.stringify(id)}`);
    return undefined;
  }
  try {
    // In-memory loading cannot repair or rewrite the input file. SDK migrations only touch this copy.
    const manager = SessionManager.inMemory(header.cwd, undefined, structuredClone(entries.map((line) => line.value)));
    if (manager.getSessionId() !== id) throw new Error("SDK/header identity mismatch");
  } catch (error) {
    issues.push(`${file.path}: cannot load Pi session: ${error.message}`);
    return undefined;
  }
  return { ...file, id, header, lines, headerLine: entries[0], managed: true, destination: join(dirname(file.path), `${id}.jsonl`) };
}
