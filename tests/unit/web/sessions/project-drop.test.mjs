import assert from "node:assert/strict";
import test from "node:test";
import { canDropSessionToGroup, projectPayloadForGroup, sessionProjectGroup } from "../../../../web/sessions/sidebar/grouping/project-drop.js";

test("project-drop maps groups and rejects unreadable, unknown, and same-group drops", () => {
  const k8s = { id: "proj-k8s", name: "k8s" };
  const deploy = { id: "proj-deploy", name: "交易机部署" };
  const ungrouped = { id: "project:ungrouped", name: "未归类" };
  const unknown = { id: "unreadable-unknown", name: "无法读取" };

  assert.deepEqual(projectPayloadForGroup(k8s), { id: "proj-k8s", name: "k8s" });
  assert.equal(projectPayloadForGroup(ungrouped), null);
  assert.equal(projectPayloadForGroup(unknown), undefined);

  const rowInK8s = { sessionId: "s1", projectId: "proj-k8s", projectName: "k8s" };
  const rowUngrouped = { sessionId: "s2" };
  assert.equal(sessionProjectGroup(rowInK8s), "proj-k8s");
  assert.equal(sessionProjectGroup(rowUngrouped), "project:ungrouped");

  assert.equal(canDropSessionToGroup(rowInK8s, k8s), false);
  assert.equal(canDropSessionToGroup(rowInK8s, deploy), true);
  assert.equal(canDropSessionToGroup(rowInK8s, ungrouped), true);
  assert.equal(canDropSessionToGroup(rowInK8s, unknown), false);

  assert.equal(canDropSessionToGroup(rowUngrouped, ungrouped), false);
  assert.equal(canDropSessionToGroup(rowUngrouped, k8s), true);
  assert.equal(canDropSessionToGroup({ key: "bad", unreadable: true }, k8s), false);
});
