import assert from "node:assert/strict";
import { probeContract } from "./probe-contract.mjs";

export async function checkNestedCalls(fixture) {
  const { run, toggle, events, host, sessionId: worker, text } = fixture;
  const original = host.state(worker);
  const payload = (execution) => ({ content: execution.result.content, details: execution.result.details,
    structuredContent: execution.result.structuredContent, isError: execution.isError });
  const cases = [
    { args: { value: "decorated", behavior: "result-decoration" }, failed: false },
    { args: {}, failed: true },
    { args: { value: "blocked", behavior: "blocked" }, failed: true },
    { args: { value: "failed", behavior: "result-failure" }, failed: true },
    { args: { value: "thrown", behavior: "throw" }, failed: true },
  ];
  for (const { args, failed } of cases) {
    await toggle("lazy:tool:search_lazy", false);
    const direct = await run("search_lazy", args);
    assert.equal(direct.result.isError, failed, text(direct.result));
    await toggle("lazy:tool:search_lazy", true);
    const offset = (await events()).length;
    const nested = await run("tool_call", { name: "search_lazy", args });
    assert.deepEqual(payload(nested.execution), payload(direct.execution), "Nested validation, block, execute and result-hook failures retain the exact direct SDK result");
    assert.equal(nested.requests[0].declarations, nested.requests[1].declarations, "Invocation does not activate or declare its hidden target");
    assert(!nested.requests[0].tools.includes("search_lazy"));
    const observed = (await events()).slice(offset);
    if (typeof args.value === "string") {
      const call = observed.find((event) => event.phase === "tool_call");
      assert(call, "The plugin receives the real nested tool_call");
      assert.equal(call.toolName, "search_lazy");
      assert.equal(call.parentToolCallId, nested.result.toolCallId);
      assert.notEqual(call.toolCallId, nested.result.toolCallId);
      assert.deepEqual(call.input, args);
      const result = observed.find((event) => event.phase === "tool_result");
      if (args.behavior === "blocked") assert.equal(result, undefined, "SDK blocked calls stop before the result hook");
      else {
        assert(result, "The plugin receives the real nested tool_result, including execution failures");
        assert.equal(result.toolName, "search_lazy");
        assert.equal(result.parentToolCallId, nested.result.toolCallId);
        assert.equal(result.toolCallId, call.toolCallId);
      }
    }
    if (args.behavior === "blocked" || typeof args.value !== "string") {
      assert(!observed.some((event) => event.phase === "execute"), "Validation and tool_call rejection prevent the actual tool body");
    }
    if (args.behavior === "result-failure") assert.deepEqual(payload(nested.execution), probeContract.failure);
    if (args.behavior === "result-decoration") {
      assert.match(text(nested.result), /RESULT_HOOK_DECORATION_7042/);
      assert.equal(nested.result.details.decorated, true);
      assert.deepEqual(nested.execution.result.structuredContent, { value: "decorated" });
    }
    const matching = host.state(worker).messages.filter((message) => message.role === "toolResult" && message.toolCallId.startsWith(`${nested.result.toolCallId}/`));
    assert.deepEqual(matching, [], "SDK nested calls do not become invented transcript results");
  }
  for (const [name, reason] of [["search_resident", /direct|declared/i], ["UNKNOWN_TOOL_7042", /unknown|does not exist|not.*(hidden|available|found)/i], ["search_disabled", /search_disabled 在本会话已关闭/]]) {
    const offset = (await events()).length;
    const { result } = await run("tool_call", { name, args: { value: "must not execute" } });
    assert.equal(result.isError, true, `${name} is denied`);
    assert.match(text(result), reason);
    const denied = (await events()).slice(offset);
    if (name === "search_disabled") {
      assert.deepEqual(denied.map((event) => event.phase), ["tool_call"], "Registered disabled targets reach permission hooks but never execute or emit a tool_result");
      assert.equal(denied[0].parentToolCallId, result.toolCallId);
    } else assert.deepEqual(denied, [], "Unregistered or non-hidden targets never enter the target pipeline");
  }
  const after = host.state(worker);
  assert.equal(after.streamId, original.streamId, "Lazy changes never reload the SDK runtime");
  assert.equal(after.sessionId, original.sessionId);
  assert.equal(after.kernel.kernelId, original.kernel.kernelId);
}
