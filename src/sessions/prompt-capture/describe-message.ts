import type { MessageOutline } from "./capture-types.ts";

const RESULT_KINDS = new Set(["tool_result", "toolResult", "functionResponse", "function_call_output"]);

/** One conversation entry of any provider shape, outlined without its text: who sent it, which kinds of block it holds, its size and whether it carries a cache marker. */
export function describeMessage(entry: unknown): MessageOutline {
  const fields = typeof entry === "object" && entry !== null ? entry as Record<string, unknown> : {};
  const role = typeof fields.role === "string" ? fields.role : typeof fields.type === "string" ? fields.type : "unknown";
  const text = JSON.stringify(entry) ?? "";
  const kinds = [...new Set(blocks(fields, role))];
  return {
    role, kinds, chars: text.length, cache: text.includes('"cache_control":') || text.includes('"cachePoint":'),
    turn: role === "user" && !kinds.some((kind) => RESULT_KINDS.has(kind)),
  };
}

function blocks(fields: Record<string, unknown>, role: string): string[] {
  if (role === "tool") return ["tool_result"];
  const content = fields.content ?? fields.parts;
  const found = typeof content === "string" ? ["text"] : Array.isArray(content) ? content.map(blockKind) : typeof fields.type === "string" ? [fields.type] : [];
  return Array.isArray(fields.tool_calls) && fields.tool_calls.length ? [...found, "tool_calls"] : found;
}

/** Anthropic and OpenAI blocks name their kind in `type`; Google parts and Bedrock blocks are keyed by it. */
function blockKind(block: unknown): string {
  if (typeof block !== "object" || block === null) return "unknown";
  const fields = block as Record<string, unknown>;
  return typeof fields.type === "string" ? fields.type : Object.keys(fields).find((key) => key !== "cache_control" && key !== "thoughtSignature") ?? "unknown";
}
