import { exactPrintable } from "../messages/exact-printable.js";
export function argsText(value, args) {
  if (typeof args.code === "string") return args.code;
  try { return JSON.stringify(args, null, 2) || ""; } catch { return exactPrintable(value); }
}
