import type { JsonValue } from "@earendil-works/pi-ai";

export function structured(value: JsonValue) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value, details: undefined };
}
