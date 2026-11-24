import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fauxAssistantMessage, getCurrentSystemMessage } from "@earendil-works/pi-ai";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";

test("the model request directs a hidden skill reader through the declared meta tools", async (t) => {
  let system;
  const f = await gatewayFixture(t, {
    config: { session: { workerTools: "direct", capabilities: { "lazy:tool:skill_read": true } } },
    answer(context) {
      system = getCurrentSystemMessage(context.messages);
      return fauxAssistantMessage("Observed the request.");
    },
  });
  const skill = join(f.root, "agent", "skills", "replay");
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, "SKILL.md"), "---\nname: replay\ndescription: Replay a prompt.\n---\n\n# Replay\n");
  await f.deploy();
  const id = await f.create();
  const receipt = await f.send(id, "Evaluate this prompt.");
  assert.equal((await f.complete(id, receipt)).status, "completed");
  assert.match(system?.sections?.skills, /MUST read.*\n\s*Use tool_search to find skill_read, then use tool_call/);
  assert.match(system?.sections?.skills, /<name>replay<\/name>/);
  const declared = system?.toolsAdded?.map(({ name }) => name);
  assert(declared?.includes("tool_search"));
  assert(declared.includes("tool_call"));
  assert(!declared.includes("skill_read"));
});
