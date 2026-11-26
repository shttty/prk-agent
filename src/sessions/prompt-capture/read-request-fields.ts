import type { RequestShape } from "./capture-types.ts";

export interface RequestFields {
  readonly system: string | null;
  readonly tools: readonly { name: string; description: string; parameters: unknown }[] | null;
  /** Conversation entries without the leading system or developer entry. */
  readonly messages: readonly unknown[] | null;
}

const SHAPES: Readonly<Record<string, RequestShape>> = {
  "openai-completions": "chat", "mistral-conversations": "chat",
  "openai-responses": "responses", "azure-openai-responses": "responses", "openai-codex-responses": "responses",
  "anthropic-messages": "anthropic", "google-generative-ai": "google", "google-vertex": "google", "bedrock-converse-stream": "bedrock",
};

export function requestShape(api: string): RequestShape | null { return SHAPES[api] ?? null; }

/** Reads the known payload locations of one API family; a missing or differently shaped field is `null`, never guessed. */
export function readRequestFields(shape: RequestShape, payload: Record<string, unknown>): RequestFields {
  if (shape === "chat" || shape === "responses") {
    const entries = array(shape === "chat" ? payload.messages : payload.input);
    const lead = entries?.[0];
    const leading = isRecord(lead) && (lead.role === "system" || lead.role === "developer");
    const instructions = typeof payload.instructions === "string" ? [payload.instructions] : [];
    const system = [...instructions, ...(leading ? [textOf(lead.content) ?? ""] : [])];
    return { system: system.length ? system.join("\n\n") : null, tools: tools(payload.tools), messages: entries && (leading ? entries.slice(1) : entries) };
  }
  if (shape === "anthropic") return { system: textOf(payload.system), tools: tools(payload.tools), messages: array(payload.messages) };
  if (shape === "bedrock") {
    return { system: textOf(payload.system), tools: tools(record(payload.toolConfig)?.tools), messages: array(payload.messages) };
  }
  const config = record(payload.config);
  const groups = array(config?.tools);
  return { system: textOf(config?.systemInstruction), tools: groups && tools(groups.flatMap((group) => array(record(group)?.functionDeclarations) ?? [])), messages: array(payload.contents) };
}

function tools(value: unknown): RequestFields["tools"] {
  const entries = array(value);
  if (!entries) return null;
  const read = entries.map((entry) => {
    const body = record(record(entry)?.function ?? record(entry)?.custom ?? record(entry)?.toolSpec ?? entry);
    if (typeof body?.name !== "string") return undefined;
    const parameters = body.parameters ?? body.input_schema ?? body.inputSchema ?? body.parametersJsonSchema ?? body.format;
    return { name: body.name, description: typeof body.description === "string" ? body.description : "", parameters };
  });
  return read.every((tool) => tool !== undefined) ? read : null;
}

/** A string, or text parts joined as the providers' own system fields hold them. */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  const parts = array(value)?.flatMap((part) => typeof record(part)?.text === "string" ? [record(part)!.text as string] : []);
  return parts && parts.length ? parts.join("\n\n") : null;
}

function array(value: unknown): unknown[] | null { return Array.isArray(value) ? value : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function record(value: unknown): Record<string, unknown> | undefined { return isRecord(value) ? value : undefined; }
