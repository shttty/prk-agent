import { readSession } from "./sessions/read-session.mjs";
import { buildSessionIdentities } from "./identity/build-session-identities.mjs";
import { rewriteSession } from "./sessions/rewrite-session.mjs";
import { rewriteSidecars } from "./references/rewrite-sidecars.mjs";

export function planMigration(inventory) {
  const issues = [];
  const sessions = inventory.sessions.map((file) => readSession(file, issues)).filter(Boolean);
  const managed = sessions.filter((session) => session.managed);
  const identities = buildSessionIdentities(managed, issues);
  const changes = managed.map((session) => rewriteSession(session, sessions, identities, issues))
    .filter((change) => change.source !== change.destination || change.text !== change.original);
  changes.push(...rewriteSidecars(inventory, identities, issues));
  const occupied = new Set(inventory.paths ?? inventory.sessions.map((file) => file.path));
  for (const change of changes) {
    if (change.source !== change.destination && occupied.has(change.destination)) {
      issues.push(`${change.source}: output path already exists: ${change.destination}`);
    }
  }
  if (issues.length) throw new Error(`Session-id migration preflight failed; no files were written:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  return changes;
}
