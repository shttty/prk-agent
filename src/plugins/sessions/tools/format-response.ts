import type { JsonValue } from "@earendil-works/pi-ai";

export const response = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data as JsonValue, details: data });
