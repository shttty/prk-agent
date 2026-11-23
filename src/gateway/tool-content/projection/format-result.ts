import { object } from "../../wire/is-record.ts";
import type { Options } from "../content-types.ts";
import { toolOutputPreview } from "../tool-output-preview.ts";

export function projectResult(value: unknown, options: Options): unknown {
  const descriptor = toolOutputPreview(value, options);
  if (!descriptor) return value;
  const result: Record<string, unknown> = { content: [{ type: "text", text: descriptor.preview }], outputPreview: descriptor };
  if (object(value)) {
    for (const key of ["role", "toolCallId", "toolName", "isError", "timestamp", "durationMs"]) {
      if (typeof value[key] === "string" || typeof value[key] === "number" || typeof value[key] === "boolean") result[key] = value[key];
    }
    const details = object(value.details) ? value.details : undefined;
    if (details) {
      const status: Record<string, unknown> = {};
      if (typeof details.outcome === "string" && ["ok", "error", "unknown", "aborted", "answers", "chat", "cancelled"].includes(details.outcome)) status.outcome = details.outcome;
      if (typeof details.interrupted === "boolean") status.interrupted = details.interrupted;
      if (Object.keys(status).length) result.details = status;
    }
  }
  return result;
}
