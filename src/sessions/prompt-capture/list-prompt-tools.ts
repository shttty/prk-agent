import type { CapturedBody, PromptToolsPart } from "./capture-types.ts";
import { readRequestFields } from "./read-request-fields.ts";

/** The tool declarations of the latest request exactly as the provider payload holds them; `exposure` names how the session registered each tool, `null` for one it does not know. */
export function listPromptTools(body: CapturedBody, exposure: (name: string) => string | null): PromptToolsPart {
  const tools = body.shape && isRecord(body.payload) ? readRequestFields(body.shape, body.payload).tools : null;
  return { seq: body.seq, at: body.at, shape: body.shape, tools: (tools ?? []).map(({ name, declaration }) => ({ name, exposure: exposure(name), declaration })) };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
