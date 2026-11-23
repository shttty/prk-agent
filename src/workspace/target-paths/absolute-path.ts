import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";

export function absolutePath(value: string): string {
  if (value === "~" || value.startsWith("~/")) {
    throw new WireError("INVALID_REQUEST", "Use an absolute target path; ~ is not expanded.", { reason: "home-unsupported" });
  }
  if (!value.startsWith("/") || /[\\\p{Cc}]/u.test(value) || posix.normalize(value) !== value || value !== "/" && value.endsWith("/")) {
    throw new WireError("INVALID_REQUEST", "Expected a normalized absolute POSIX target path.", { reason: "invalid-path" });
  }
  return value;
}
