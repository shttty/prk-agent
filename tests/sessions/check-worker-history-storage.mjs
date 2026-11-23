import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, open, readFile, lstat, rename, symlink, unlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createSessionHistory } from "../../src/sessions/history/assemble-history.ts";
import { loadHistory } from "../../src/sessions/history/catalog/load-history.ts";
import { removeSessionFiles } from "../../src/sessions/history/sdk-files/remove-session-files.ts";
import { checkHistoryClone } from "./worker-history/check-clone.mjs";
import { checkUnreadableHistory } from "./worker-history/check-unreadable.mjs";

async function exclusiveSession(file, cwd, directory, label, binding) {
  const handle = await open(file, "wx", 0o600);
  await handle.close();
  const manager = SessionManager.open(file, directory, cwd);
  manager.appendSessionInfo(label);
  if (binding !== undefined) {
    const sessionId = manager.getSessionId();
    manager.appendCustomEntry("gateway-session-binding", { ...binding, sessionId });
  }
  return manager;
}

const root = await mkdtemp(join(tmpdir(), "pi-session-history-").replace(/\\/g, "/"));
const cwd = join(root, "project");
const directory = join(cwd, ".pi", "gateway-sessions");
await mkdir(cwd, { recursive: true });

try {
  const previousUmask = process.umask(0o027);
  let history;
  try {
    history = await createSessionHistory({ cwd, directory });
  } finally {
    process.umask(previousUmask);
  }
  assert.equal((await lstat(directory)).mode & 0o777, 0o750, "history directory creation follows umask");
  await chmod(directory, 0o751);
  history = await createSessionHistory({ cwd, directory });
  assert.equal((await lstat(directory)).mode & 0o777, 0o751, "existing history directory permissions are unchanged");

  const createUmask = process.umask(0o027);
  let manager;
  try {
    manager = history.create("target-a", "Alpha", "/srv/session");
  } finally {
    process.umask(createUmask);
  }
  const alphaId = manager.getSessionId();
  const stored = history.get(alphaId);
  assert.equal((await lstat(stored.sessionFile)).mode & 0o777, 0o640, "session file creation follows umask");

  const createdBytes = await readFile(stored.sessionFile, "utf8");
  assert(createdBytes.startsWith('{"type":"session"'), "SDK header exists before any model response");
  assert.equal(JSON.parse(createdBytes.split("\n")[0]).id, alphaId);
  assert.equal(Object.hasOwn(stored, "name"), false, "Native session has no second routing identity");
  assert(!createdBytes.includes("token") && !createdBytes.includes("http"), "credentials and URLs are not persisted");

  manager.appendMessage({ role: "user", content: [{ type: "text", text: "persisted message" }], timestamp: Date.now() });
  manager.appendMessage({ role: "assistant", content: [{ type: "text", text: "persisted assistant" }], timestamp: Date.now() });
  history = await createSessionHistory({ cwd, directory });
  history.rename(alphaId, "Renamed");

  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(alphaId)?.label, "Renamed", "list/get use the SDK title");
  assert.equal(history.get(alphaId)?.target, "target-a", "worker target survives reopen");
  assert.equal(history.get(alphaId)?.cwd, "/srv/session", "Execution cwd survives reopen");

  history.get(alphaId).manager.appendCustomEntry("gateway-session-kernel-binding", { version: 1, sessionId: alphaId,
    target: "target-a", kernelId: "kernel-alpha", kernelName: "python3", cwd, url: "http://127.0.0.1:29876", status: "active" });
  history = await checkHistoryClone({ history, cwd, directory, sourceSessionId: alphaId });

  const renameTarget = history.create("target-rename", "Rename", "/srv/session");
  history.rename(renameTarget.getSessionId(), "Restored");
  assert.equal(history.get(renameTarget.getSessionId())?.label, "Restored");


  const foreignFile = join(directory, "foreign.jsonl");
  const boundSessionCount = history.listAll().length;
  await exclusiveSession(foreignFile, cwd, directory, "Foreign SDK session");
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.listAll().length, boundSessionCount, "unbound SDK sessions are not adopted");
  const foreignLines = (await readFile(foreignFile, "utf8")).trimEnd().split("\n");
  const foreignHeader = JSON.parse(foreignLines[0]);
  foreignHeader.id = history.get(alphaId).sessionId;
  foreignLines[0] = JSON.stringify(foreignHeader);
  await writeFile(foreignFile, `${foreignLines.join("\n")}\n`);
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.listAll().length, boundSessionCount, "An unbound SDK header cannot quarantine a managed session");
  assert.equal(history.get(foreignHeader.id)?.sessionId, alphaId, "Native identity lookup still resolves the managed session");

  await checkUnreadableHistory({ cwd, directory, exclusiveSession, healthySessionId: alphaId });

  const emptyFile = join(directory, "empty.jsonl");
  const emptyHandle = await open(emptyFile, "wx", 0o600);
  await emptyHandle.close();
  await createSessionHistory({ cwd, directory });
  assert.equal(await readFile(emptyFile, "utf8"), "", "empty foreign file is not initialized");
  await unlink(emptyFile);

  const strayFile = join(directory, "stray-cwd.jsonl");
  const storedBinding = { version: 4, target: "target-stray" };
  // Legacy execution handles remain inert custom history, never a new-runtime authority.
  const strayKernel = await exclusiveSession(strayFile, cwd, directory, "Stray kernel", { ...storedBinding, cwd: "/srv/stray" });
  strayKernel.appendCustomEntry("gateway-session-kernel-binding", { version: 1, target: "target-stray", sessionId: strayKernel.getSessionId(), kernelId: "k1", kernelName: "python3", cwd: "proj", url: "http://127.0.0.1:1/", status: "active" });
  const strayHistory = await createSessionHistory({ cwd, directory });
  assert.equal(strayHistory.get(strayKernel.getSessionId())?.kernel, undefined);
  assert.equal(strayHistory.get(strayKernel.getSessionId())?.cwd, "/srv/stray", "Legacy handle data cannot override execution selection");
  await unlink(strayFile);

  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get("../escape"), undefined, "An arbitrary identity never derives a file path");

  const beta = history.create("target-b", "Beta", "/srv/session");
  const betaPath = beta.getSessionFile();
  assert(betaPath);
  const purgeContext = await loadHistory({ cwd, directory });
  const purgeRecord = purgeContext.records.get(beta.getSessionId());
  const outsidePath = join(root, "outside.jsonl");
  await rename(betaPath, outsidePath);
  await symlink(outsidePath, betaPath);
  purgeRecord.sessionFile = outsidePath;
  assert.throws(() => removeSessionFiles(purgeContext, beta.getSessionId()), /outside directory/i, "purge refuses a path outside the sessions directory");
  await history.delete(beta.getSessionId());
  assert.equal((await lstat(outsidePath)).isFile(), true, "purge unlinks the session path, not a symlink target");
  assert.equal(history.get(beta.getSessionId()), undefined, "delete removes the managed session");

  const sameA = history.create("shared-target", "Same A", "/srv/session-a");
  const sameB = history.create("shared-target", "Same B", "/srv/session-b");
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(sameA.getSessionId())?.cwd, "/srv/session-a", "session A cwd survives history reopen");
  assert.equal(history.get(sameB.getSessionId())?.cwd, "/srv/session-b", "session B cwd survives history reopen");

  for (const session of history.listAll()) history.delete(session.sessionId);
  console.log("PASS worker history: selected-branch clone isolation/labels, scoped ownership, umask permissions, malformed metadata and duplicate errors, purge path containment and distinct workspace persistence.");
} finally {
  await rm(root, { recursive: true, force: true });
}
