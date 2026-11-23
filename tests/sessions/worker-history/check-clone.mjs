import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createSessionHistory } from "../../../src/sessions/history/assemble-history.ts";
import { readDerivedSession } from "../../../src/sessions/derivation/read-derived-session.ts";

export async function checkHistoryClone({ history, cwd, directory, sourceSessionId }) {
  const source = history.get(sourceSessionId);
  assert(source, "clone source is managed");
  const sourceId = source.sessionId;
  const sourceFile = source.sessionFile;
  source.manager.appendCustomEntry("gateway-derived-session", {
    sessionId: sourceId, createdBy: "parent", owner: "parent", taskId: "clone-task", task: "Source task",
    lifecycle: "persistent", phase: "working", model: "history-check/controlled", thinkingLevel: "low",
  });
  const sourceAnchor = source.manager.getLeafId();
  const labelLeaf = source.manager.appendLabelChange(sourceAnchor, "source bookmark");
  source.manager.branch(sourceAnchor);
  source.manager.appendMessage({ role: "user", content: [{ type: "text", text: "off-branch message" }], timestamp: Date.now() });
  source.manager.appendMessage({ role: "assistant", content: [{ type: "text", text: "off-branch assistant" }], timestamp: Date.now() });
  source.manager.branch(labelLeaf);
  const sourceLeaf = source.manager.getLeafId();
  const sourceContext = source.manager.buildSessionContext().messages;
  const sourceBytes = await readFile(sourceFile, "utf8");
  const clonedManager = history.clone(sourceId, "Alpha clone");
  const cloneId = clonedManager.getSessionId();
  assert.notEqual(cloneId, sourceId, "clone has a fresh SDK identity");
  assert.equal(clonedManager.getHeader().id, cloneId, "clone identity is the native JSONL header identity");
  assert.equal(Object.hasOwn(history.get(cloneId), "name"), false, "clone has no second routing identity");
  assert.deepEqual(clonedManager.buildSessionContext().messages, sourceContext, "clone preserves the selected branch context");
  assert.equal(clonedManager.getLabel(sourceAnchor), "source bookmark", "SDK branch clone preserves native labels");
  assert.equal(readDerivedSession(clonedManager), undefined, "clone does not inherit task ownership");
  assert.equal(source.manager.getLeafId(), sourceLeaf, "clone preserves source active leaf");
  assert.equal(await readFile(sourceFile, "utf8"), sourceBytes, "clone does not rewrite the source file");
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(cloneId)?.sessionId, cloneId, "clone reloads after restart");

  const noAssistant = history.create("target-a", "No assistant", "/srv/session");
  const selectedUser = noAssistant.appendMessage({ role: "user", content: [{ type: "text", text: "selected user" }], timestamp: Date.now() });
  noAssistant.appendMessage({ role: "assistant", content: [{ type: "text", text: "other branch assistant" }], timestamp: Date.now() });
  noAssistant.branch(selectedUser);
  assert.throws(() => history.clone(noAssistant.getSessionId(), "No assistant clone"), /assistant-free|persist/i, "assistant-free selected branch is refused even when another disk branch has an assistant");

  const sleepingSource = history.create("target-a", "Sleeping source", "/srv/session");
  sleepingSource.appendMessage({ role: "user", content: [{ type: "text", text: "source user" }], timestamp: Date.now() });
  sleepingSource.appendMessage({ role: "assistant", content: [{ type: "text", text: "source assistant" }], timestamp: Date.now() });
  history.setSleeping(sleepingSource.getSessionId(), true);
  const awakeClone = history.clone(sleepingSource.getSessionId(), "Independent clone");
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(sleepingSource.getSessionId())?.sleeping, true, "source remains sleeping");
  assert.equal(history.get(awakeClone.getSessionId())?.sleeping, undefined, "clone does not inherit source runtime authority after restart");

  const unmanagedForkPath = SessionManager.open(sourceFile, directory, cwd).createBranchedSession(sourceLeaf);
  assert(unmanagedForkPath, "SDK creates a native unmanaged fork");
  const unmanagedFork = SessionManager.open(unmanagedForkPath, directory, cwd);
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(unmanagedFork.getSessionId()), undefined, "fork without a self-scoped binding is unmanaged");

  const peer = history.create("target-b", "Peer", "/srv/session");
  history.assignProject(sourceId, { id: "analysis", name: "分析项目" });
  history.assignProject(peer.getSessionId(), { id: "analysis", name: "不能覆盖已有项目名称" });
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(sourceId).projectId, "analysis", "project membership survives reopen");
  assert.equal(history.get(peer.getSessionId()).projectName, "分析项目", "same project has one name across instances");
  history.assignProject(sourceId, null);
  history = await createSessionHistory({ cwd, directory });
  assert.equal(history.get(sourceId).projectId, undefined, "ungrouping survives reopen");
  assert.equal(history.get(peer.getSessionId()).projectId, "analysis", "ungrouping leaves siblings untouched");
  assert.throws(() => history.assignProject(sourceId, { id: "bad", name: "\n" }), /project/i);
  history.delete(peer.getSessionId());
  return history;
}
