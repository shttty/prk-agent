import { object } from "../../wire/is-record.ts";
import type { Options } from "../content-types.ts";
import { toolInputPreview } from "../preview-input.ts";
import { projectResult } from "./format-result.ts";
import { toolOutputPreview } from "../tool-output-preview.ts";

export function projectMessage<T>(value: T, options: Options): T {
  if (!object(value)) return value;
  if (value.role === "toolResult") return projectResult(value, options) as T;
  if (value.role === "custom" && value.customType === "kernel-event") {
    const details = object(value.details) ? { ...value.details } : {};
    delete details.resultDetails;
    const message = { ...value, details, ...(Array.isArray(value.content)
      ? { content: value.content.filter((part) => !object(part) || part.type !== "image") } : {}) };
    const descriptor = toolOutputPreview(message, options);
    return (descriptor ? { ...message, content: [{ type: "text", text: descriptor.preview }], outputPreview: descriptor } : message) as T;
  }
  if (value.role !== "assistant" || !Array.isArray(value.content)) return value;
  return { ...value, content: value.content.map((part: unknown) => {
    if (!object(part) || part.type !== "toolCall") return part;
    const descriptor = toolInputPreview(part.arguments, options, typeof part.argumentsError === "string" ? part.argumentsError : undefined);
    if (!descriptor) return part;
    const call: Record<string, unknown> = { ...part, arguments: {}, inputPreview: descriptor };
    delete call.argumentsError;
    return call;
  }) };
}
