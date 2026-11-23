import assert from "node:assert/strict";

export async function checkRenderers(fixture) {
  const { action, run, toggle, host, sessionId: worker } = fixture;
  const render = (id) => action("extension-ui", { operation: "render", width: 240, height: 40,
    clientId: "nested-renderers", expandedToolCallIds: [id] });
  const lines = (node) => node?.lines.map((line) => line.trimEnd());
  for (const [name, shell] of [["search_lazy", "self"], ["search_description", "default"]]) {
    const args = { value: `renderer-${shell}`, behavior: "renderer" };
    const views = [];
    for (const nested of [false, true]) {
      await toggle(`lazy:tool:${name}`, nested);
      const held = Promise.withResolvers();
      let target, prompt, finalView;
      const subscription = host.session(worker).subscribe((event) => {
        if (event.type === "session_event" && event.details?.sdkType === "tool_execution_start" && event.details.toolName === name) target = event.details;
        if (event.type !== "extension_ui") return;
        const checkpoint = host.state(worker).extensionUi.prompts.find((item) => item.title === "Tool renderer checkpoint");
        if (checkpoint && target) held.resolve(checkpoint);
      });
      const verify = (view, partial) => {
        const tool = view.tools[target.toolCallId];
        assert(tool, "The real tool's own ID has a client extension-ui entry");
        assert.equal(tool.shell, shell, "The real registered tool supplies renderShell");
        assert.equal(tool.call?.id, `tool-${target.toolCallId}-call`);
        assert.equal(tool.result?.id, `tool-${target.toolCallId}-result`);
        assert.deepEqual(lines(tool.call), [`RENDER_CALL_7042:${name}:${args.value}`]);
        assert.deepEqual(lines(tool.result), [`RENDER_RESULT_7042:${args.value}`,
          `args=${args.value} state=${args.value}`,
          `partial=${partial}/${partial} expanded=true/true error=false`,
          `started=true complete=true duration=${partial ? "undefined" : "number"}`]);
        assert.equal(view.toolErrors[target.toolCallId], undefined);
        if (nested) assert.deepEqual(view.tools[target.parentToolCallId], { shell: "default" }, "The outer tool_call rendering is unchanged");
        return { shell: tool.shell, call: lines(tool.call), result: lines(tool.result) };
      };
      const pending = run(nested ? "tool_call" : name, nested ? { name, args } : args, worker, async ({ toolCallId, completedTools }) => {
        assert.equal(target.parentToolCallId, nested ? toolCallId : undefined, "The native SDK owns parent correlation");
        assert(completedTools.some((event) => event.toolCallId === target.toolCallId && event.toolName === name && event.parentToolCallId === target.parentToolCallId));
        finalView = verify(await render(target.toolCallId), false);
      });
      try {
        prompt = await Promise.race([held.promise, pending.then(() => { throw new Error("Renderer fixture completed without its live checkpoint"); })]);
        assert.deepEqual(target.args, args);
        const partialView = verify(await render(target.toolCallId), true);
        await action("extension-ui", { operation: "dialog", id: prompt.id, value: true });
        prompt = undefined;
        const completed = await pending;
        assert.equal(completed.result.toolName, nested ? "tool_call" : name);
        await action("extension-ui", { operation: "release-client", clientId: "nested-renderers" });
        const after = await render(target.toolCallId);
        assert.deepEqual(verify(after, false), finalView, "A fresh client rebuilds the same plugin rendering after agent_end");
        if (nested) {
          assert.deepEqual(after.tools[completed.result.toolCallId], { shell: "default" });
          assert(!host.state(worker).messages.some((message) => message.toolCallId === target.toolCallId), "Rendering invents no nested transcript result");
        }
        views.push({ partial: partialView, final: finalView });
      } finally {
        subscription.unsubscribe();
        if (prompt) await action("extension-ui", { operation: "dialog", id: prompt.id, value: true });
        await pending.catch(() => {});
      }
    }
    assert.deepEqual(views[1], views[0], "Direct and native nested calls use identical renderer phases and context");
  }
  const args = { value: "bounded-arguments", behavior: "x".repeat(9000) };
  const completed = await run("tool_call", { name: "search_lazy", args });
  const own = completed.result.nestedCalls.calls.find((call) => call.id === `${completed.result.toolCallId}/1`);
  assert.equal(own.arguments, undefined, "The SDK omits oversized nested arguments");
  assert(own.argumentsBytes > 8192);
  await action("extension-ui", { operation: "release-client", clientId: "nested-renderers" });
  const historical = (await render(own.id)).tools[own.id];
  assert.equal(historical.shell, "self");
  assert.deepEqual(lines(historical.call), ["RENDER_CALL_7042:search_lazy:bounded-arguments"]);
  assert.deepEqual(lines(historical.result), ["RENDER_RESULT_7042:bounded-arguments",
    "args=bounded-arguments state=bounded-arguments",
    "partial=false/false expanded=true/true error=false",
    "started=true complete=true duration=number"], "The persisted outer arguments and passthrough result suffice without nested payload storage");
}
