import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { isAbsoluteCwd } from "../../../config/execution-target/is-absolute-cwd.ts";
import { invalid } from "../reject-invalid-history.ts";

export function validateKernelCwd(cwd: unknown, limits: LimitsOptions): asserts cwd is string {
  if (typeof cwd !== "string" || cwd.trim().length === 0 || cwd.length > limits.cwdChars || cwd.includes("\0") || /\p{Cc}/u.test(cwd) || !isAbsoluteCwd(cwd)) invalid("kernel binding cwd at /cwd (an absolute path is required)");
}
