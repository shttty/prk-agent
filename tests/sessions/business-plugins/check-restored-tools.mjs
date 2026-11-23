import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { waitForAskState } from "../../fixtures/ask/wait-for-ask-state.mjs";

export async function checkRestoredTools(fixture, worker, plugin, home, lazy = false) {
  const { host, run, idle } = fixture;
  const call = (name, args = {}) => lazy ? run(worker, "tool_call", { name, args }) : run(worker, name, args);
  if (plugin === "ask") {
    // ask returns human-readable text, so use the same public submit/dialog path
    // without the prompt fixture's JSON-only convenience projection.
    await idle(worker);
    const operation = { tool: lazy ? "tool_call" : "ask", args: { questions: [{ id: "proof", question: "Continue?", options: [{ label: "Yes" }] }] } };
    if (lazy) operation.args = { name: "ask", args: operation.args };
    const admission = await host.session(worker).submit({ requestId: randomUUID(), message: `PROMPT_OPERATION ${JSON.stringify(operation)}` });
    assert.equal(admission.accepted, true);
    const prompt = await waitForAskState(() => host.state(worker).extensionUi.prompts.find(({ kind }) => kind === "ask"), Boolean, "restored business ask dialog");
    const answer = await host.nativeAction(worker, { sessionId: worker, requestId: randomUUID(), action: "extension-ui", args: {
      operation: "dialog", id: prompt.id, answers: [{ id: "proof", selected: [0] }], clientId: "business-plugins",
    } });
    assert.equal(answer.status, "completed", JSON.stringify(answer));
    assert.equal((await admission.completion).status, "completed");
    const result = host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolName === operation.tool);
    assert.equal(result.isError, false);
    assert.match(result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n"), /proof: Yes/u);
    assert((await fixture.captureFor(worker)).wire, "The restored ask turn must reach the real provider HTTP path");
  } else if (plugin === "skill-tools") {
    const name = `business-${lazy ? "lazy" : "resident"}`;
    const created = await call("skill_manage", { action: "create", name, scope: "global", description: "Business plugin integration proof", whenToUse: "Testing the actual skill factory", evidence: "The integration disabled and re-enabled the skill-tools group.", procedure: ["Inspect BUSINESS_SKILL_71039."], pitfalls: [], verification: [] });
    assert.equal(created.data.skill.name, name);
    assert.match(created.data.skill.content, /BUSINESS_SKILL_71039/u);
    assert.deepEqual((await call("skill_manage", { action: "delete", name })).data, { deleted: name });
    await run(worker, "kernel_code", { code: `assert business_plugin_sentinel == 71039\nassert 'BUSINESS_SKILL_READ_71039' in gateway.skill_read(path=${JSON.stringify(join(home, "skills", "business-skill", "SKILL.md"))})` });
  } else if (plugin === "memory") {
    const saved = await call("memory", { target: "memory", action: "add", content: `BUSINESS_MEMORY_71039_${lazy ? "lazy" : "resident"}` });
    assert(saved.data.usage.some(({ target, chars }) => target === "memory" && chars > 0), "Restored memory writes the real isolated store");
  } else if (plugin === "plugin-config") {
    const result = await call("plugin_config", { action: "get", provider: "business-proof" });
    assert.equal(result.data.provider, "business-proof");
    assert.equal(result.data.configured, false);
  } else if (plugin === "terminals") {
    const name = "business-proof";
    const sent = await call("terminal_textsend", { name, text: "printf BUSINESS_TERMINAL_71039", yield_s: 5, timeout_s: 15 });
    assert.equal(sent.data.status, "done");
    assert.match(sent.data.output, /BUSINESS_TERMINAL_71039/u);
    const listed = (await call("terminal_list")).data.terminals.find((terminal) => terminal.name === name);
    assert(listed, "Restored terminal_list discovers the real terminal created by terminal_textsend");
    assert.equal(listed.owner, "model");
    assert.equal(typeof listed.label, "string");
    assert.equal(listed.integration, "ready");
    assert.equal((await call("terminal_keysend", { name, keys: "C-l", yield_s: 0 })).data.name, name);
    assert.equal((await call("terminal_read", { name, yield_s: 0 })).data.name, name);
    assert.deepEqual((await call("terminal_set", { name, quiet_notify: true })).data, { name, quiet_notify: true });
    assert.deepEqual((await call("terminal_close", { name })).data, { name, closed: true });
  } else if (plugin === "sessions") {
    const status = await call("space_status");
    assert(status.data.targets.some(({ id }) => id === "fixture"));
    assert(status.data.sessions.some(({ sessionId }) => sessionId === worker));
  } else {
    assert.fail(`Unknown business plugin ${plugin}`);
  }
}
