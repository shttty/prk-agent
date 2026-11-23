import type { JsonValue } from "@earendil-works/pi-ai";

export const result = (value: JsonValue) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value, details: value });
