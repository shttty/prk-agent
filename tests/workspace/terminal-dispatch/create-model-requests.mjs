import assert from "node:assert/strict";
import { fauxAssistantMessage, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";

export function createTerminalModelRequests() {
  const pending = new Map();
  const schemas = new Map();
  return {
    schemas,
    issue(context, { tool, args, id }) {
      const names = getCurrentTools(context.messages).map(({ name }) => name);
      if (tool === "kernel_code") {
        assert(names.includes(tool), "kernel_code remains directly declared");
        return fauxAssistantMessage(fauxToolCall(tool, args, { id }), { stopReason: "toolUse" });
      }
      assert(tool.startsWith("terminal_"));
      assert(!names.includes(tool), `${tool} is lazy, not directly declared`);
      for (const name of ["tool_search", "tool_call"]) assert(names.includes(name), `${tool} is reachable through declared ${name}`);
      const searchId = `${id}-search`;
      pending.set(searchId, { tool, args, id });
      return fauxAssistantMessage(fauxToolCall("tool_search", { query: tool }, { id: searchId }), { stopReason: "toolUse" });
    },
    resume(context) {
      const last = context.messages.at(-1);
      if (last?.role !== "toolResult" || !pending.has(last.toolCallId)) return undefined;
      const { tool, args, id } = pending.get(last.toolCallId);
      pending.delete(last.toolCallId);
      assert.equal(last.toolName, "tool_search");
      assert.equal(last.isError, false);
      const text = last.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
      const schema = JSON.parse(text).tools.find(({ name }) => name === tool);
      assert(schema, `The real tool_search discovers ${tool}`);
      schemas.set(tool, schema);
      const names = getCurrentTools(context.messages).map(({ name }) => name);
      assert(!names.includes(tool), "Discovering a lazy terminal does not activate its declaration");
      assert(names.includes("tool_call"));
      return fauxAssistantMessage(fauxToolCall("tool_call", { name: tool, args }, { id }), { stopReason: "toolUse" });
    },
  };
}
