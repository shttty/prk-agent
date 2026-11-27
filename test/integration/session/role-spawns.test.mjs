import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage, getCurrentSystemMessage } from "@earendil-works/pi-ai";
import { gatewayFixture, text, tool } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

const roles = { lead: { description: "Splits work.", spawns: ["task"] }, leaf: { description: "Does one piece.", spawns: [] } };

test("a role's spawns limit which roles its sessions may spawn, and the prompt lists only those", async (t) => {
  const prompts = new Map();
  const spawn = (role, label) => tool("session_spawn", { context: "Nested", tasks: [{ task: "Nested work", label, ...(role ? { role } : {}) }] });
  const f = await gatewayFixture(t, { config: { derivation: { roles } }, answer(context) {
    const last = context.messages.at(-1);
    const body = text(last);
    const key = body.match(/# Your assignment\n(\w+)/)?.[1] ?? body;
    if (last?.role === "user") prompts.set(key, getCurrentSystemMessage(context.messages)?.sections?.sessions);
    if (key === "LEAF_TRY") return spawn(undefined, "from-leaf");
    if (key === "LEAD_TASK") return spawn("task", "from-lead");
    if (key === "LEAD_SMALL") return spawn("small", "small-from-lead");
    return fauxAssistantMessage("Controlled reply.");
  } });
  await f.stageArtifacts();
  const owner = await f.create("Owner");
  const tasks = [["LEAF_TRY", "leaf"], ["LEAD_TASK", "lead"], ["LEAD_SMALL", "lead"]].map(([task, role]) => ({ task, label: task, role }));
  const spawned = await f.send(owner, `TOOL ${JSON.stringify({ name: "session_spawn", args: { context: "Roles", tasks } })}`);
  assert.equal((await f.complete(owner, spawned)).status, "completed");
  const outcome = async (label) => {
    const id = await until(async () => (await f.request("workbench")).sessions.find((row) => row.label === label)?.sessionId, `${label} row`);
    const result = await until(() => f.state(id).messages.find((message) => message.role === "toolResult" && message.toolName === "session_spawn"), `${label} spawn result`);
    return { isError: result.isError === true, ...JSON.parse(text(result)) };
  };

  const leaf = await outcome("LEAF_TRY");
  assert.equal(leaf.isError, true);
  assert.match(leaf.errors[0].error, /This role cannot spawn child sessions\./);
  const allowed = await outcome("LEAD_TASK");
  assert.equal(allowed.isError, false);
  assert.equal(allowed.children.length, 1);
  const refused = await outcome("LEAD_SMALL");
  assert.equal(refused.isError, true);
  assert.match(refused.errors[0].error, /may only spawn roles: task; requested "small"\./);

  assert.match(prompts.get("LEAF_TRY"), /^Your role cannot spawn child sessions; session_spawn will be rejected\.$/m);
  assert.doesNotMatch(prompts.get("LEAF_TRY"), /Roles for session_spawn/);
  assert.match(prompts.get("LEAD_TASK"), /^Roles for session_spawn:\ntask: Default role for general coding and implementation sub-sessions\.\nPick the role whose description fits the task; omit role for task\.$/m);

  assert.equal((await f.complete(owner, await f.send(owner, "List roles"))).status, "completed");
  const names = [...prompts.get("List roles").matchAll(/^([\w-]+)(?:: .*)?$/gm)].map((match) => match[1])
    .filter((name) => ["lead", "leaf", "small", "task"].includes(name));
  assert.deepEqual(names, ["lead", "leaf", "small", "task"]);
  assert.match(prompts.get("List roles"), /^lead: Splits work\.$/m);
});
