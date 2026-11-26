import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { GatewayDescribeRequest } from "../../../kernel/callback/cell-callback-schema.ts";
import { mergeStubs } from "../../tool-declarations/python-stubs/merge-stubs.ts";
import { renderToolStub } from "../../tool-declarations/python-stubs/render-tool-stub.ts";
import { summarizeDescription } from "../../tool-declarations/python-stubs/summarize-description.ts";
import { rankTools } from "../../tool-declarations/tool-rank/rank-tools.ts";
import type { RuntimeContext } from "../runtime-state.ts";

/**
 * What gateway.describe() / describe(name) / search(query, limit) answer, over every callable tool (deferred ones included):
 * the list of {name, description}, one tool's full stub, or the best matches as {name, description, stub}. Descriptions are first paragraphs.
 */
export function describeGatewayTools(ctx: RuntimeContext, callable: readonly AgentTool[], request: GatewayDescribeRequest): unknown {
  if (request.name != null && request.query !== undefined) throw new Error("Pass a tool name or a search query, not both.");
  const guidelines = new Map((ctx.callbackSession?.getAllTools() ?? ctx.toolInventory).map((tool) => [tool.name, tool.promptGuidelines]));
  const tools = callable.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters, outputSchema: tool.outputSchema, promptGuidelines: guidelines.get(tool.name) }));
  const stub = (tool: (typeof tools)[number], detail: "summary" | "full") => mergeStubs([renderToolStub(tool, detail)]).text;
  if (request.query !== undefined) {
    return rankTools(tools, request.query, request.limit).map((tool) => ({ name: tool.name, description: summarizeDescription(tool.description), stub: stub(tool, "summary") }));
  }
  if (request.name == null) return tools.map(({ name, description }) => ({ name, description: summarizeDescription(description) }));
  const tool = tools.find(({ name }) => name === request.name);
  if (!tool) throw new Error(`No callable Gateway tool named ${JSON.stringify(request.name)}; call gateway.search(query) or gateway.describe() to find one.`);
  return stub(tool, "full");
}
