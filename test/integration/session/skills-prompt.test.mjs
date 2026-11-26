import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fauxAssistantMessage, getCurrentSystemMessage } from "@earendil-works/pi-ai";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { verifyPromptReferences } from "../../fixtures/prompt/verify-prompt-references.mjs";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";

test("the model request directs a hidden skill reader through the declared meta tools", async (t) => {
  let system, messages;
  const f = await gatewayFixture(t, {
    config: { session: { workerTools: "direct", capabilities: { "lazy:tool:skill_read": true } } },
    answer(context) {
      system = getCurrentSystemMessage(context.messages);
      messages = context.messages;
      return fauxAssistantMessage("Observed the request.");
    },
  });
  const skill = join(f.root, "agent", "skills", "replay");
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, "SKILL.md"), "---\nname: replay\ndescription: Replay a prompt.\n---\n\n# Replay\n");
  await f.stageArtifacts();
  const id = await f.create();
  const receipt = await f.send(id, "Evaluate this prompt.");
  assert.equal((await f.complete(id, receipt)).status, "completed");
  assert.match(system?.sections?.skills, /MUST read.*\n\s*Use tool_search to find skill_read, then use tool_call/);
  assert.match(system?.sections?.skills, /<name>replay<\/name>/);
  const declared = system?.toolsAdded?.map(({ name }) => name);
  assert(declared?.includes("tool_search"));
  assert(declared.includes("tool_call"));
  assert(!declared.includes("skill_read"));
  await verifyPromptReferences(f, id, messages);
});

test("GET /prompt reports the last provider request and what changed since the one before", async (t) => {
  const endpoint = await startCompletionsEndpoint(t);
  const f = await gatewayFixture(t, { web: true, endpoint, config: { session: { workerTools: "code" } } });
  await f.stageArtifacts();
  const id = await f.create();
  const prompt = async () => {
    const response = await fetch(`${f.url}/api/sessions/${id}/prompt`, { headers: { Origin: f.url } });
    assert.equal(response.status, 200);
    return response.json();
  };
  const turn = async (message) => assert.equal((await f.complete(id, await f.send(id, message))).status, "completed");
  assert.deepEqual(await prompt(), { sessionId: id, latest: null, previousAt: null, diff: null });

  await turn("First question");
  const first = await prompt();
  const wire = endpoint.bodies[0];
  assert.equal(first.latest.shape, "chat");
  assert.equal(first.latest.provider, "relay");
  assert.equal(first.latest.system.text, wire.messages[0].content);
  assert.match(first.latest.system.text, /<kernel>\n/);
  assert.deepEqual(first.latest.system.sections.entries.map(({ key }) => key).filter((key) => key === "kernel" || key === "gateway_calls"), ["kernel", "gateway_calls"]);
  const kernel = first.latest.system.sections.entries.find(({ key }) => key === "kernel");
  assert.match(first.latest.system.text.slice(kernel.start, kernel.start + kernel.chars), /^<kernel>\n[\s\S]*<\/kernel>$/);
  assert.deepEqual(first.latest.tools.map(({ name }) => name), wire.tools.map((tool) => tool.function.name));
  assert(first.latest.tools.some(({ name }) => name === "kernel_code"));
  assert.deepEqual(first.latest.messages.count, wire.messages.length - 1);
  assert.equal(first.diff, null);
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, new RegExp(`${endpoint.apiKey}|authorization|apiKey`, "i"));

  await turn("Second question");
  const second = await prompt();
  assert.equal(second.previousAt, first.latest.at);
  assert.equal(second.latest.messages.count, endpoint.bodies[1].messages.length - 1);
  assert.deepEqual(second.diff.messages, { before: first.latest.messages.count, after: second.latest.messages.count, commonPrefix: first.latest.messages.count, prefixStable: true, firstChange: null });
  assert.deepEqual([second.diff.system.changed, second.diff.tools.reordered, second.diff.modelChanged], [false, false, false]);
  assert.deepEqual([second.diff.tools, second.diff.sections].map((delta) => [delta.added, delta.removed, delta.changed]), [[[], [], []], [[], [], []]]);

  const switched = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "capabilities", args: { changes: [{ id: "tool:kernel_read", enabled: false }] } });
  assert.equal(switched.status, "completed");
  await turn("Third question");
  const { diff } = await prompt();
  assert.deepEqual(diff.tools.removed.map(({ key }) => key), ["kernel_read"]);
  assert(diff.sections.changed.some(({ key }) => key === "kernel"));
  assert.equal(diff.system.changed, true);
});
