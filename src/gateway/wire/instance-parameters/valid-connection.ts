import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { validAbsolutePath } from "./is-absolute-target-path.ts";

export function validConnection(value: unknown, limits: LimitsOptions): boolean {
  if (!object(value) || !keys(value, ["local", "sshCommand", "python", "cwd"]) || typeof value.local !== "boolean") return false;
  if (value.local ? value.sshCommand !== undefined : typeof value.sshCommand !== "string" || !value.sshCommand.trim()) return false;
  if (typeof value.sshCommand === "string" && (value.sshCommand.length > limits.sshCommandChars || /\p{Cc}/u.test(value.sshCommand))) return false;
  if (value.cwd !== undefined && !validAbsolutePath(value.cwd, limits)) return false;
  return value.python === undefined || validAbsolutePath(value.python, limits);
}
