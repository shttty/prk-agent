import { isPayload } from "../../../payload/is-payload.ts";
const IDENTITY = ["sessionId", "kernelId", "cellId", "toolCallId"];
export function sameCell(left: unknown, right: unknown): boolean {
  return isPayload(left) && isPayload(right) && IDENTITY.every((key) => typeof left[key] === "string" && Boolean(left[key]) && left[key] === right[key]);
}
