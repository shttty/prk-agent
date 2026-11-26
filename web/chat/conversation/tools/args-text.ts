import type { Payload } from "../../payload/is-payload.ts";
import { exactPrintable } from "../messages/exact-printable.ts";
export function argsText(value: unknown, args: Payload): string {
  if (typeof args.code === "string") return args.code;
  try { return JSON.stringify(args, null, 2) || ""; } catch { return exactPrintable(value); }
}
