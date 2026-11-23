import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { Text } from "@earendil-works/pi-tui";
import { probeContract } from "./probe-contract.mjs";

export default function registerProbes(pi) {
  const names = { search_lazy: true, search_description: true, search_resident: true, search_default: true, search_disabled: true, search_model_only: true };
  const record = (ctx, event) => appendFileSync(join(ctx.cwd, "tool-search-events.jsonl"), `${JSON.stringify(event)}\n`);
  pi.on("tool_call", (event, ctx) => {
    if (!names[event.toolName]) return;
    record(ctx, { phase: "tool_call", toolName: event.toolName, toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId, input: event.input });
    if (event.input.behavior === "blocked") return { block: true, reason: "TOOL_SEARCH_BLOCKED_7042\nExact second line." };
  });
  pi.on("tool_result", (event, ctx) => {
    if (!names[event.toolName]) return;
    record(ctx, { phase: "tool_result", toolName: event.toolName, toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId, input: event.input, content: event.content, details: event.details, isError: event.isError });
    if (event.input.behavior === "result-failure") return probeContract.failure;
    if (event.input.behavior === "result-decoration") return {
      content: [...event.content, { type: "text", text: "RESULT_HOOK_DECORATION_7042" }],
      details: { ...event.details, decorated: true }, structuredContent: event.structuredContent,
    };
  });
  for (const name of Object.keys(names)) pi.registerTool({
    name, label: name, exposure: name === "search_model_only" ? "model-only" : "direct",
    description: name === "search_lazy" ? probeContract.description : name === "search_description"
      ? "Inspect the amber payload.\nDo not put this second sentence in the one-line inventory." : `Execute ${name} acceptance payload.`,
    ...(name === "search_lazy" ? { promptSnippet: probeContract.snippet, promptGuidelines: probeContract.guidelines } : {}),
    parameters: probeContract.parameters, outputSchema: probeContract.outputSchema,
    ...(name === "search_lazy" || name === "search_description" ? {
      renderShell: name === "search_lazy" ? "self" : "default",
      renderCall(input, _theme, context) {
        context.state.value = input.value;
        return new Text(`RENDER_CALL_7042:${name}:${input.value}`, 0, 0);
      },
      renderResult(result, options, _theme, context) {
        return new Text([`RENDER_RESULT_7042:${result.details.value}`,
          `args=${context.args.value} state=${context.state.value}`,
          `partial=${options.isPartial}/${context.isPartial} expanded=${options.expanded}/${context.expanded} error=${context.isError}`,
          `started=${context.executionStarted} complete=${context.argsComplete} duration=${typeof context.durationMs}`].join("\n"), 0, 0);
      },
    } : {}),
    async execute(_id, input, _signal, onUpdate, ctx) {
      record(ctx, { phase: "execute", toolName: name, input });
      if (input.behavior === "renderer") {
        await onUpdate?.({ content: [{ type: "text", text: `PARTIAL_7042:${input.value}` }], details: { value: input.value } });
        await ctx.ui.confirm("Tool renderer checkpoint", input.value);
      }
      if (input.behavior === "throw") throw new Error("TOOL_SEARCH_EXECUTE_FAILURE_7042\nExact second line.");
      return { content: [{ type: "text", text: `PAYLOAD_7042:${input.value}` }],
        details: { value: input.value, fixture: 7042 }, structuredContent: { value: input.value } };
    },
  });
}
