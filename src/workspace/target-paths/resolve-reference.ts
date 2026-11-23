import { posix } from "node:path";
import { WireError } from "../../gateway/wire/create-error.ts";
import { absolutePath } from "./absolute-path.ts";

export function resolveReference(cwd: string, token: string): { directory: string; fragment: string } {
  absolutePath(cwd);
  if (token === "~" || token.startsWith("~/")) throw new WireError("INVALID_REQUEST", "~ is not supported in references.", { reason: "home-unsupported" });
  if (/[\\\p{Cc}]/u.test(token)) throw new WireError("INVALID_REQUEST", "Invalid reference path.", { reason: "invalid-path" });
  const slash = token.lastIndexOf("/");
  return { directory: posix.resolve(cwd, token.slice(0, slash + 1)), fragment: token.slice(slash + 1).toLocaleLowerCase() };
}
