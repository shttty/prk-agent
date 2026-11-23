import assert from "node:assert/strict";
import { SessionManager } from "@earendil-works/pi-coding-agent";

export async function readSessionEntries(cwd, directory, sessionId) {
  const session = (await SessionManager.list(cwd, directory)).find(({ id }) => id === sessionId);
  assert(session, `Native SDK history exists for ${sessionId}`);
  return SessionManager.open(session.path, directory).getEntries();
}
