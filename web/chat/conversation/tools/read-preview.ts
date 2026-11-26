import { isPayload } from "../../payload/is-payload.ts";
import type { ToolContentPreview } from "../../../../src/gateway/wire/web-types.ts";

/** The Gateway's content preview descriptor on a tool result, or undefined when the result carries none. */
export function readPreview(value: unknown): ToolContentPreview | undefined {
  if (!isPayload(value) || typeof value.preview !== "string" || typeof value.bytes !== "number" || typeof value.lines !== "number" || typeof value.version !== "string") return undefined;
  return { preview: value.preview, bytes: value.bytes, lines: value.lines, version: value.version, ...(typeof value.imageCount === "number" ? { imageCount: value.imageCount } : {}) };
}
