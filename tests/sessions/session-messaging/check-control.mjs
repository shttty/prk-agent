import assert from "node:assert/strict";

export async function checkControl(f, ancestor) {
  const parent = await f.spawn(ancestor, "Control parent");
  const child = await f.spawn(parent.sessionId, "Control grandchild");
  const sibling = await f.spawn(ancestor, "Control sibling");
  const root = await f.create("Explicit root");
  const supervisor = await f.create("Project supervisor");
  const outside = await f.create("Outside-project supervisor");
  await f.client.request("assignProject", { sessionId: supervisor, project: { id: "acceptance-controlled", name: "Acceptance controlled" } });
  await f.client.request("assignProject", { sessionId: f.get(child.sessionId).sessionId, project: { id: "acceptance-controlled", name: "Acceptance controlled" } });
  await f.client.request("assignProject", { sessionId: outside, project: { id: "acceptance-outside", name: "Acceptance outside" } });
  const rootState = await f.client.request("setSessionRoot", { sessionId: root });
  assert.equal(rootState.rootSessionId, f.get(root).sessionId, "Public root setter takes a routing name and exposes native SDK identity");
  const roles = await f.client.request("setProjectSupervisor", { sessionId: supervisor });
  assert.equal(roles.supervisors["acceptance-controlled"], f.get(supervisor).sessionId);
  assert.equal((await f.client.request("sessionControl")).rootSessionId, f.get(root).sessionId);
  for (const actor of [parent.sessionId, ancestor, root, supervisor]) {
    await f.call(actor, "session_manage", { action: "project", session: child.sessionId, project: "Acceptance controlled" });
    assert.equal(f.get(child.sessionId).projectId, "acceptance-controlled", `${actor} controls the target through fixed ownership/root/project rules`);
    const observed = await f.call(actor, "session_list", { sessionId: child.sessionId });
    assert.equal(observed.sessionId, child.sessionId, `${actor} can observe a controlled session`);
    assert.equal(observed.parentSessionId, parent.sessionId);
    const sent = await f.call(actor, "session_send", { to: child.sessionId, message: `Authorized abort from ${actor}`, delivery: "abort", expectReply: false });
    assert.equal(sent.accepted, true);
    await f.idle(child.sessionId);
  }
  for (const [actor, target] of [[child.sessionId, parent.sessionId], [sibling.sessionId, child.sessionId], [outside, child.sessionId]]) {
    await f.call(actor, "session_list", { sessionId: target }, /control|authority|owner|ancestor|supervisor|root/i);
    await f.call(actor, "session_manage", { action: "destroy", child: target }, /control|authority|owner|ancestor|supervisor|root/i);
    await f.call(actor, "session_manage", { action: "transfer", child: target, to: f.get(root).sessionId }, /control|authority|owner|ancestor|supervisor|root/i);
    await f.call(actor, "session_manage", { action: "project", session: target, project: null }, /control|authority|owner|ancestor|supervisor|root/i);
    await f.call(actor, "session_send", { to: f.get(target).sessionId, message: "Denied abort", delivery: "abort" }, /control|authority|owner|ancestor|supervisor|root/i);
    assert(f.get(target), "A rejected manager action neither archives nor retargets its subject");
    for (const delivery of ["steer", "followUp"]) {
      assert.equal((await f.call(actor, "session_send", { to: f.get(target).sessionId, message: `Reachable without control: ${delivery}`, delivery, expectReply: false })).accepted, true);
      await f.idle(target);
    }
  }
  await f.call(parent.sessionId, "session_manage", { action: "supervisor", session: sibling.sessionId }, /root/i);
  await f.client.request("assignProject", { sessionId: f.get(sibling.sessionId).sessionId, project: { id: "acceptance-controlled", name: "Acceptance controlled" } });
  await f.call(root, "session_manage", { action: "supervisor", session: sibling.sessionId });
  assert.equal((await f.client.request("sessionControl")).supervisors["acceptance-controlled"], sibling.sessionId, "Root-only supervisor promotion stays inside the fifth tool");
  const roster = await f.call(root, "session_list");
  for (const row of roster) {
    const fields = ["parentSessionId", "sessionId", "sessionName", "state"];
    if (row.pendingParentSessionId !== undefined) fields.push("pendingParentSessionId");
    for (const marker of ["self", "root", "supervisor"]) if (row[marker] === true) fields.push(marker);
    assert.deepEqual(Object.keys(row).sort(), fields.sort(), "Default session_list contains only compact identity, relationship, state and true markers");
  }
  const listed = roster.find((entry) => entry.sessionId === child.sessionId);
  assert.deepEqual(listed, { sessionId: child.sessionId, sessionName: "Control grandchild", state: "idle", parentSessionId: parent.sessionId });
  assert.equal(f.get(child.sessionId).derivation.createdBy, f.get(parent.sessionId).sessionId, "Creator remains available on the authoritative workbench, not the compact model roster");
  assert.equal(f.get(child.sessionId).projectId, "acceptance-controlled");
  assert.equal(roster.find((entry) => entry.sessionId === sibling.sessionId).supervisor, true);
  assert.deepEqual(roster.filter((row) => row.self === true).map((row) => row.sessionId), [root]);
  assert.equal(roster.find((row) => row.self === true).root, true);
  await f.call(ancestor, "session_manage", { action: "destroy", child: parent.sessionId });
  assert(!f.get(parent.sessionId) && !f.get(child.sessionId), "Ancestor control destroys the currently-owned subtree");
  await f.call(ancestor, "session_manage", { action: "destroy", child: sibling.sessionId });
  assert.equal((await f.client.request("sessionControl")).supervisors["acceptance-controlled"], f.get(supervisor).sessionId, "Destroying the promoted supervisor elects the earliest surviving project member");
}
