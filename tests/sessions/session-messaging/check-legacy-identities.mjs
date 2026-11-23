import assert from "node:assert/strict";

export async function checkLegacyIdentities(f, root) {
  const owner = f.legacy["legacy-owner"], child = f.legacy["legacy-child"];
  const grandchild = f.legacy["legacy-grandchild"], peer = f.legacy["legacy-peer"];
  for (const session of Object.values(f.legacy)) assert.equal(Object.hasOwn(session, "name"), false);
  assert.deepEqual(f.host.workbench().unreadableSessions, [], "Historical role-less native sessions remain readable");
  const saved = await f.entries(grandchild.sessionId);
  const rows = await f.call(root, "session_list");
  assert.deepEqual(rows.find((row) => row.sessionId === grandchild.sessionId), {
    sessionId: grandchild.sessionId, sessionName: grandchild.sessionName, state: "sleeping", parentSessionId: child.sessionId,
  });
  assert.deepEqual(rows.find((row) => row.sessionId === owner.sessionId), {
    sessionId: owner.sessionId, sessionName: owner.sessionName, state: "sleeping", parentSessionId: null,
  });
  for (const actor of [owner, child]) {
    const observed = await f.call(actor.sessionId, "session_list", { sessionId: grandchild.sessionId });
    assert.equal(observed.parentSessionId, child.sessionId, "Historical owner and ancestor comparisons resolve to native identity");
    assert.equal(Object.hasOwn(observed, "role"), false, "Reading historical role-less sessions does not select task retroactively");
    assert(observed.recent.some(({ text }) => text.includes("LEGACY_HISTORY_legacy-grandchild")));
    assert.equal(f.get(grandchild.sessionId).state, "sleeping", "Read-only inspection does not wake historical targets");
  }
  await f.call(peer.sessionId, "session_list", { sessionId: grandchild.sessionId }, /control|authority|owner|ancestor|supervisor|root/i);
  await f.call(child.sessionId, "session_list", { sessionId: owner.sessionId }, /control|authority|owner|ancestor|supervisor|root/i);
  assert.deepEqual(await f.entries(grandchild.sessionId), saved, "Reading historical native JSONL never rewrites entries");
  const sent = await f.call(root, "session_send", { to: grandchild.sessionId, message: "NATIVE_ID_TO_LEGACY_ROUTE", expectReply: false });
  assert.equal(sent.to, grandchild.sessionId);
  await f.idle(grandchild.sessionId);
  assert(f.peers(grandchild.sessionId).some(({ body }) => body.includes("NATIVE_ID_TO_LEGACY_ROUTE")));
  await f.call(owner.sessionId, "session_manage", { action: "project", session: grandchild.sessionId, project: "Legacy native project" });
  assert.equal(f.get(grandchild.sessionId).projectName, "Legacy native project");
  await f.client.request("setSessionRoot", { sessionId: root });
  await f.call(root, "session_manage", { action: "supervisor", session: grandchild.sessionId });
  assert.equal((await f.client.request("sessionControl")).supervisors[f.get(grandchild.sessionId).projectId], grandchild.sessionId);
  await f.call(owner.sessionId, "session_manage", { action: "transfer", child: grandchild.sessionId, to: peer.sessionId });
  const offered = (await f.call(root, "session_list")).find((row) => row.sessionId === grandchild.sessionId);
  assert.equal(offered.parentSessionId, child.sessionId);
  assert.equal(offered.pendingParentSessionId, peer.sessionId);
  await f.call(peer.sessionId, "session_manage", { action: "accept", child: grandchild.sessionId });
  const accepted = await f.call(peer.sessionId, "session_list", { sessionId: grandchild.sessionId });
  assert.equal(accepted.parentSessionId, peer.sessionId);
  assert.equal(Object.hasOwn(accepted, "role"), false, "Messaging, project edits and transfer preserve an absent historical role");
  assert.equal(f.get(grandchild.sessionId).derivation.createdBy, child.sessionId, "Transfer preserves the historical creator rather than rewriting it");
  await f.call(peer.sessionId, "session_manage", { action: "destroy", child: grandchild.sessionId });
  assert.equal(f.get(grandchild.sessionId), undefined);
  assert.deepEqual(f.host.workbench().unreadableSessions, []);
}
