import type { ToolContentPreview } from "../../../../src/gateway/wire/web-types.ts";
import { isRecord } from "../is-record.ts";

/** A truncated-content preview as the Gateway sends it with a tool call or result; anything else is no preview. */
export function toolPreview(value: unknown): ToolContentPreview | undefined {
  return isRecord(value) && typeof value.preview === "string" && typeof value.version === "string"
    ? value as unknown as ToolContentPreview
    : undefined;
}
