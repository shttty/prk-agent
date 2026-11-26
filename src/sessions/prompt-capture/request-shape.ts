import type { RequestShape } from "./capture-types.ts";

const SHAPES: Readonly<Record<string, RequestShape>> = {
  "openai-completions": "chat", "mistral-conversations": "chat",
  "openai-responses": "responses", "azure-openai-responses": "responses", "openai-codex-responses": "responses",
  "anthropic-messages": "anthropic", "google-generative-ai": "google", "google-vertex": "google", "bedrock-converse-stream": "bedrock",
};

export function requestShape(api: string): RequestShape | null { return SHAPES[api] ?? null; }
