import { isRecord } from "../is-record.ts";
import { exactPrintable } from "./exact-printable.ts";

export function toolCode(details: unknown): string {
  if (!isRecord(details)) return "";
  const args = details.args || details.arguments || details.input;
  // Records without `code` keep their structure (a `content` field is a write payload here, not message content).
  return isRecord(args) ? (typeof args.code === "string" ? args.code : JSON.stringify(args, null, 2)) : exactPrintable(args);
}
