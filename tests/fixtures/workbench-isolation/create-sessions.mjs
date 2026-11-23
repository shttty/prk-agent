import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createSessionHistory } from "../../../src/sessions/history/assemble-history.ts";

export async function createIsolationSessions(root, cwd, scenario) {
  const directory = join(root, "history");
  const history = await createSessionHistory({ cwd: root, directory });
  const good = history.create("fixture", "Isolation healthy", "python3", cwd);
  good.appendMessage({ role: "user", content: "ISOLATION_HEALTHY_HISTORY", timestamp: Date.now() });
  const bad = history.create("fixture", "Isolation unreadable", "python3", cwd);
  bad.appendMessage({ role: "user", content: "ISOLATION_UNREADABLE_HISTORY", timestamp: Date.now() });
  let archivedGood;
  if (scenario.archived) {
    const companion = history.create("fixture", "Isolation healthy archive", "python3", cwd);
    companion.appendMessage({ role: "user", content: "ISOLATION_HEALTHY_ARCHIVE", timestamp: Date.now() });
    history.archive(companion.getSessionId(), bad.getSessionId(), false);
    history.archive(bad.getSessionId(), bad.getSessionId(), false);
    archivedGood = { sessionId: companion.getSessionId() };
  }
  if (scenario.kind === "native") {
    bad.appendCustomEntry("gateway-native-session-state", { version: 1, autoRetry: "invalid" });
  } else if (scenario.kind === "archive") {
    bad.appendCustomEntry("gateway-session-trash", {
      version: 1, sessionId: bad.getSessionId(), trashed: true, group: "invalid/group", at: new Date().toISOString(),
    });
  } else if (scenario.kind === "derived") {
    bad.appendCustomEntry("gateway-derived-session", {
      sessionId: bad.getSessionId(), createdBy: good.getSessionId(), owner: good.getSessionId(), taskId: "isolation-task",
      task: "Persisted isolation fixture", lifecycle: "persistent", phase: "working",
      model: "recovery-controlled/local", thinkingLevel: "off",
      ...(scenario.archived ? { destroyDelegates: true } : { phase: "invalid" }),
    });
  }
  const listed = await SessionManager.listAll(directory);
  assert.deepEqual(listed.map((entry) => entry.id).sort(), [good.getSessionId(), bad.getSessionId(), ...(archivedGood ? [archivedGood.sessionId] : [])].sort(), "Fixtures are real persisted SDK sessions before Gateway startup");
  if (scenario.kind === "header") {
    const bytes = await readFile(bad.getSessionFile(), "utf8");
    const newline = bytes.indexOf("\n");
    const header = JSON.parse(bytes.slice(0, newline));
    delete header.id;
    await writeFile(bad.getSessionFile(), `${JSON.stringify(header)}${bytes.slice(newline)}`);
  }
  return {
    directory,
    archivedGood,
    good: { sessionId: good.getSessionId(), sessionFile: good.getSessionFile() },
    bad: { ...(scenario.kind === "header" ? {} : { sessionId: bad.getSessionId() }), sessionFile: bad.getSessionFile(), bytes: await readFile(bad.getSessionFile(), "utf8") },
  };
}
