import { createHash } from "node:crypto";
import type { CapturedRequest, RecordedRequest, RenderedSystem, RequestDigest, RequestModel } from "./capture-types.ts";
import { readRequestFields, requestShape } from "./read-request-fields.ts";

/** Projects one provider payload into sizes and hashes; the payload itself, headers and message text are never kept. */
export function recordRequest(payload: unknown, model: RequestModel | undefined, rendered: RenderedSystem | undefined, at: Date): RecordedRequest {
  const body = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const shape = requestShape(model?.api ?? "");
  const fields = shape ? readRequestFields(shape, body) : { system: null, tools: null, messages: null };
  const matched = fields.system !== null && rendered?.text === fields.system ? rendered : undefined;
  const sections = matched ? Object.entries(matched.sections) : null;
  const request: CapturedRequest = {
    at: at.toISOString(), provider: model?.provider ?? "unknown", model: model?.id ?? "unknown", api: model?.api ?? "unknown", shape,
    payloadKeys: Object.keys(body), payloadChars: JSON.stringify(payload)?.length ?? 0,
    system: fields.system === null ? null : { text: fields.system, chars: fields.system.length,
      sections: matched && sections ? { baseChars: matched.base.length, entries: sections.map(([key, text]) => ({ key, chars: text.length })) } : null },
    tools: fields.tools && fields.tools.map((tool) => ({ name: tool.name, descriptionChars: tool.description.length, parametersChars: json(tool.parameters).length })),
    messages: fields.messages && { count: fields.messages.length, chars: fields.messages.reduce<number>((total, message) => total + json(message).length, 0) },
    repeats: 0,
  };
  const digest: RequestDigest = {
    system: fields.system === null ? null : hash(fields.system),
    sections: sections && Object.fromEntries(sections.map(([key, text]) => [key, hash(text)])),
    tools: fields.tools && Object.fromEntries(fields.tools.map((tool) => [tool.name, hash(json(tool))])),
    toolOrder: fields.tools?.map((tool) => tool.name) ?? [],
    messages: fields.messages && fields.messages.map((message) => hash(json(message))),
  };
  return { request, digest };
}

/** The same system, tools and messages: a replay of the previous request, not a new one. */
export function sameRequest(a: RequestDigest, b: RequestDigest): boolean {
  return a.system === b.system && JSON.stringify(a.tools) === JSON.stringify(b.tools) && JSON.stringify(a.messages) === JSON.stringify(b.messages);
}

function json(value: unknown): string { return JSON.stringify(value) ?? ""; }
function hash(text: string): string { return createHash("sha1").update(text).digest("base64"); }
