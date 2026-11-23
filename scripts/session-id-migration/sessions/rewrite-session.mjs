import { dirname, resolve } from "node:path";
import { rewriteMetadata } from "../metadata/rewrite-metadata.mjs";

export function rewriteSession(session, sessions, identities, issues) {
  const text = session.lines.map((line) => {
    const entry = line.value;
    if (entry === undefined) return line.raw;
    const location = `${session.path}:${line.line} (${entry.type === "custom" ? entry.customType : entry.type})`;
    let next = entry;
    if (line === session.headerLine && Object.hasOwn(entry, "parentSession")) {
      if (typeof entry.parentSession !== "string" || !entry.parentSession.trim()) {
        issues.push(`${location}/parentSession: missing SDK parent file reference`);
      } else {
        const path = resolve(dirname(session.path), entry.parentSession);
        const parents = sessions.filter((candidate) => candidate.path === path);
        if (parents.length > 1) {
          issues.push(`${location}/parentSession: ambiguous SDK parent file ${JSON.stringify(entry.parentSession)} (resolved ${path})`);
        } else if (parents[0] && parents[0].destination !== parents[0].path) {
          next = { ...entry, parentSession: parents[0].destination };
        }
      }
    } else {
      next = rewriteMetadata(entry, location, identities, issues);
    }
    if (JSON.stringify(next) === JSON.stringify(entry)) return line.raw;
    const ending = line.raw.endsWith("\r\n") ? "\r\n" : line.raw.endsWith("\n") ? "\n" : "";
    return `${JSON.stringify(next)}${ending}`;
  }).join("");
  return { source: session.path, destination: session.destination, text, original: session.text };
}
